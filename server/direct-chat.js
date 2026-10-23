const crypto = require("crypto");

const EMPTY_KEYS = ["directConversations", "directMessages"];
const TABLES = [
  { key:"directConversations", table:"meo_direct_conversations", idKey:"id", fields:{ id:"id", companyId:"company_id", workerId:"worker_id", companyUserId:"company_user_id", createdBy:"created_by", createdAt:"created_at", updatedAt:"updated_at" } },
  { key:"directMessages", table:"meo_direct_messages", idKey:"id", fields:{ id:"id", conversationId:"conversation_id", senderId:"sender_id", body:"body", readAt:"read_at", createdAt:"created_at" } }
];
const COMPANY_CONTACT_ROLES = new Set(["company", "manager", "employee", "contractor"]);
const ROLE_LABELS = { company:"Direção", manager:"Administração", employee:"Colaborador", contractor:"Prestador", worker:"Trabalhador" };

function uid(prefix) { return `${prefix}_${crypto.randomUUID()}`; }
function stamp() { return new Date().toISOString(); }
function text(value,max=3000) { return String(value || "").trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,"").slice(0,max); }
function fail(message,status=400) { const error = new Error(message); error.status = status; throw error; }

function verifiedRelationship(db,companyId,workerId) {
  return (db.employmentRelationships || []).some(item => item.companyId === companyId && item.workerId === workerId && item.verificationStatus === "verified");
}

function companyContact(db,userId,companyId) {
  return db.users.find(user => user.id === userId && user.companyId === companyId && user.active !== false && COMPANY_CONTACT_ROLES.has(user.role));
}

function conversationFor(db,auth,id) {
  const conversation = (db.directConversations || []).find(item => item.id === id);
  if (!conversation) fail("Conversa não encontrada.",404);
  const workerAccess = auth.user.role === "worker" && conversation.workerId === auth.user.id;
  const companyAccess = conversation.companyUserId === auth.user.id && conversation.companyId === auth.company.id;
  if (!workerAccess && !companyAccess) fail("Conversa não encontrada.",404);
  if (!verifiedRelationship(db,conversation.companyId,conversation.workerId)) fail("Esta conversa exige um vínculo de trabalho verificado.",403);
  return conversation;
}

function contactRecord(db,conversation,viewerId) {
  const contactId = viewerId === conversation.workerId ? conversation.companyUserId : conversation.workerId;
  const user = db.users.find(item => item.id === contactId);
  const company = db.companies.find(item => item.id === conversation.companyId);
  return { id:contactId, name:user?.name || "Utilizador", role:user?.role || "", roleLabel:ROLE_LABELS[user?.role] || user?.role || "", companyId:conversation.companyId, companyName:company?.name || "Empresa" };
}
function auditContext(auth,companyId) { return auth.company.id === companyId ? auth : { ...auth,company:{ ...auth.company,id:companyId } }; }

function snapshot(db,auth) {
  const visible = (db.directConversations || []).filter(item => auth.user.role === "worker" ? item.workerId === auth.user.id : item.companyUserId === auth.user.id && item.companyId === auth.company.id);
  const conversations = visible.map(conversation => {
    const items = (db.directMessages || []).filter(message => message.conversationId === conversation.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
    const last = items.at(-1) || null;
    return { ...conversation, contact:contactRecord(db,conversation,auth.user.id), lastMessage:last ? { body:last.body, senderId:last.senderId, createdAt:last.createdAt } : null,
      unreadCount:items.filter(message => message.senderId !== auth.user.id && !message.readAt).length };
  }).sort((a,b) => String(b.lastMessage?.createdAt || b.updatedAt).localeCompare(String(a.lastMessage?.createdAt || a.updatedAt)));

  let contacts;
  if (auth.user.role === "worker") {
    const companyIds = new Set((db.employmentRelationships || []).filter(item => item.workerId === auth.user.id && item.verificationStatus === "verified").map(item => item.companyId));
    contacts = db.users.filter(user => companyIds.has(user.companyId) && user.active !== false && COMPANY_CONTACT_ROLES.has(user.role)).map(user => {
      const company = db.companies.find(item => item.id === user.companyId);
      return { id:user.id,name:user.name,role:user.role,roleLabel:ROLE_LABELS[user.role] || user.role,companyId:user.companyId,companyName:company?.name || "Empresa" };
    });
  } else if (COMPANY_CONTACT_ROLES.has(auth.user.role)) {
    const workerIds = new Set((db.employmentRelationships || []).filter(item => item.companyId === auth.company.id && item.verificationStatus === "verified").map(item => item.workerId));
    contacts = db.users.filter(user => workerIds.has(user.id) && user.role === "worker" && user.active !== false).map(user => ({ id:user.id,name:user.name,role:user.role,roleLabel:ROLE_LABELS.worker,companyId:auth.company.id,companyName:auth.company.name }));
  } else contacts = [];
  contacts.sort((a,b) => a.companyName.localeCompare(b.companyName,"pt-PT") || a.name.localeCompare(b.name,"pt-PT"));
  return { conversations, contacts, unreadCount:conversations.reduce((sum,item) => sum + item.unreadCount,0) };
}

function createDirectChat(h) {
  let notifyRecipient = async () => {};
  async function handle(req,res,pathname) {
    if (!pathname.startsWith("/api/direct-chat")) return false;
    if (req.method === "GET" && pathname === "/api/direct-chat") {
      const db = await h.readDb(),auth = h.requireAuth(db,req); h.sendJson(res,200,{ chat:snapshot(db,auth) }); return true;
    }
    const detailMatch = pathname.match(/^\/api\/direct-chat\/conversations\/([^/]+)$/);
    const readMatch = pathname.match(/^\/api\/direct-chat\/conversations\/([^/]+)\/read$/);
    if (req.method === "GET" && detailMatch) {
      const db = await h.readDb(),auth = h.requireAuth(db,req);
      const conversation = conversationFor(db,auth,decodeURIComponent(detailMatch[1]));
      const messages = db.directMessages.filter(item => item.conversationId === conversation.id).sort((a,b) => a.createdAt.localeCompare(b.createdAt));
      h.sendJson(res,200,{ conversation:{ ...conversation,contact:contactRecord(db,conversation,auth.user.id) },messages }); return true;
    }
    const body = req.method === "GET" ? {} : await h.readBody(req);
    const result = await h.mutateDb(async db => {
      const auth = h.requireAuth(db,req);
      if (req.method === "POST" && pathname === "/api/direct-chat/conversations") {
        const contactUserId = text(body.contactUserId,120);
        let companyId,workerId,companyUserId;
        if (auth.user.role === "worker") {
          const contact = db.users.find(user => user.id === contactUserId && user.active !== false && COMPANY_CONTACT_ROLES.has(user.role));
          if (!contact || !verifiedRelationship(db,contact.companyId,auth.user.id)) fail("Só pode contactar membros de empresas com um vínculo verificado.",403);
          companyId = contact.companyId; workerId = auth.user.id; companyUserId = contact.id;
        } else {
          if (!COMPANY_CONTACT_ROLES.has(auth.user.role)) fail("Sem permissão para iniciar conversas.",403);
          const worker = db.users.find(user => user.id === contactUserId && user.role === "worker" && user.active !== false);
          if (!worker || !verifiedRelationship(db,auth.company.id,worker.id)) fail("Só pode contactar trabalhadores com um vínculo verificado.",403);
          companyId = auth.company.id; workerId = worker.id; companyUserId = auth.user.id;
        }
        let conversation = db.directConversations.find(item => item.companyId === companyId && item.workerId === workerId && item.companyUserId === companyUserId);
        if (!conversation) {
          conversation = { id:uid("chat"),companyId,workerId,companyUserId,createdBy:auth.user.id,createdAt:stamp(),updatedAt:stamp() };
          db.directConversations.push(conversation);
          h.audit(db,auditContext(auth,companyId),"direct_conversation",conversation.id,"direct_conversation.created",{ companyId,workerId,companyUserId },req);
        }
        return { conversation,chat:snapshot(db,auth) };
      }
      if (req.method === "POST" && pathname === "/api/direct-chat/messages") {
        const conversation = conversationFor(db,auth,text(body.conversationId,160));
        const messageBody = text(body.body,3000); if (!messageBody) fail("Escreva uma mensagem.");
        const recent = db.directMessages.filter(item => item.senderId === auth.user.id && Date.parse(item.createdAt) > Date.now() - 60000).length;
        if (recent >= 30) fail("Aguarde um minuto antes de enviar mais mensagens.",429);
        const message = { id:uid("chatmsg"),conversationId:conversation.id,senderId:auth.user.id,body:messageBody,readAt:null,createdAt:stamp() };
        db.directMessages.push(message); conversation.updatedAt = message.createdAt;
        h.audit(db,auditContext(auth,conversation.companyId),"direct_conversation",conversation.id,"direct_message.sent",{ messageId:message.id },req);
        return { message,recipientId:auth.user.id === conversation.workerId ? conversation.companyUserId : conversation.workerId,chat:snapshot(db,auth) };
      }
      if (req.method === "PATCH" && readMatch) {
        const conversation = conversationFor(db,auth,decodeURIComponent(readMatch[1]));
        const readAt = stamp(); let changed = 0;
        for (const message of db.directMessages.filter(item => item.conversationId === conversation.id && item.senderId !== auth.user.id && !item.readAt)) { message.readAt = readAt; changed += 1; }
        if (changed) h.audit(db,auditContext(auth,conversation.companyId),"direct_conversation",conversation.id,"direct_messages.read",{ count:changed },req);
        return { changed,chat:snapshot(db,auth) };
      }
      fail("Operação não encontrada.",404);
    });
    if (result.message) await notifyRecipient(result.recipientId);
    if (result.recipientId) delete result.recipientId;
    h.sendJson(res,req.method === "POST" && pathname === "/api/direct-chat/conversations" ? 201 : 200,result); return true;
  }
  return { handle,snapshot,setPushNotifier:fn => { notifyRecipient = fn; } };
}

module.exports = { EMPTY_KEYS,TABLES,createDirectChat };
