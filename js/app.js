
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./config.js";

const configured = SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const backdrop = $("#backdrop"), modal = $("#modal");

function safe(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function toast(title,msg){
  const t=document.createElement("div"); t.className="toast";
  t.innerHTML=`<b>${safe(title)}</b><p>${safe(msg)}</p>`; $("#toasts").appendChild(t);
  setTimeout(()=>t.remove(),5000);
}
function open(content){modal.innerHTML=content;backdrop.classList.add("open")}
function close(){backdrop.classList.remove("open")}
$("#close").onclick=close; backdrop.onclick=e=>e.target===backdrop&&close();
document.addEventListener("keydown",e=>e.key==="Escape"&&close());

$("#menu").onclick=()=>$("#nav").classList.toggle("open");
$$("nav a").forEach(a=>a.onclick=()=>$("#nav").classList.remove("open"));

async function currentUser(){
  if(!supabase) return null;
  const {data:{user}}=await supabase.auth.getUser();
  return user || null;
}
async function profile(){
  const u=await currentUser(); if(!u) return null;
  const {data}=await supabase.from("profiles").select("*").eq("id",u.id).single();
  return data || null;
}

$("#status").onclick=()=>open(`<label>RAVENOID // SYSTEM STATUS</label><h3>ALL SYSTEMS NOMINAL</h3>
<p>Frontend: ONLINE<br>Database: ${configured?"CONNECTED":"NOT CONFIGURED"}<br>Realtime: ${configured?"READY":"WAITING FOR CONFIG"}<br>Build: RV-03</p>`);

$("#account").onclick=async()=>{
  const u=await currentUser();
  if(u) openAccount(u); else openAuth();
};

async function openAccount(u){
  open(`<label>RAVENOID // IDENTITY</label><h3>${safe(u.email)}</h3>
  <p>Your account is connected to the RAVENOID backend.</p>
  <div class="form"><button class="btn primary" id="myTickets">MY TICKETS</button><button class="btn" id="logout">LOGOUT</button></div>`);
  $("#logout").onclick=async()=>{await supabase.auth.signOut();close();$("#account").textContent="LOGIN";toast("SIGNED OUT","Your RAVENOID session has ended.")};
  $("#myTickets").onclick=openMyTickets;
}

function openAuth(){
open(`<label>RAVENOID // ACCOUNT</label><h3>IDENTITY ACCESS</h3>
<div class="form"><input id="display" placeholder="Display name (for signup)">
<input id="email" type="email" placeholder="Email address">
<input id="password" type="password" placeholder="Password (min 6 characters)">
<button class="btn primary" id="login">LOGIN ↗</button>
<button class="btn" id="signup">CREATE ACCOUNT</button>
<button class="btn" id="admin">ADMIN COMMAND CENTER</button></div>`);
$("#login").onclick=async()=>{
 if(!supabase)return toast("BACKEND","Add Supabase credentials in js/config.js.");
 const {error}=await supabase.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
 if(error) toast("LOGIN FAILED",error.message); else {close();$("#account").textContent="ACCOUNT";toast("AUTHENTICATED","Welcome back to RAVENOID.")}
};
$("#signup").onclick=async()=>{
 if(!supabase)return toast("BACKEND","Configure Supabase first.");
 const email=$("#email").value.trim(), password=$("#password").value, display=$("#display").value.trim();
 const {error}=await supabase.auth.signUp({email,password,options:{data:{display_name:display}}});
 if(error)toast("SIGNUP FAILED",error.message);else toast("ACCOUNT CREATED","Check your email if confirmation is enabled.");
};
$("#admin").onclick=()=>openAdminLogin();
}
function openAdminLogin(){
open(`<label>RAVENOID // RESTRICTED</label><h3>COMMAND CENTER</h3>
<p>Admin access uses Supabase Auth + the database role. The PIN is not trusted in public JavaScript.</p>
<div class="form"><input id="ae" type="email" placeholder="Admin email"><input id="ap" type="password" placeholder="Password"><button class="btn primary" id="goAdmin">AUTHENTICATE ↗</button></div>`);
$("#goAdmin").onclick=async()=>{
 if(!supabase)return toast("BACKEND","Configure Supabase first.");
 const {data,error}=await supabase.auth.signInWithPassword({email:$("#ae").value.trim(),password:$("#ap").value});
 if(error)return toast("ACCESS DENIED",error.message);
 const {data:p}=await supabase.from("profiles").select("role").eq("id",data.user.id).single();
 if(p?.role==="admin") location.href="admin.html"; else {await supabase.auth.signOut();toast("ACCESS DENIED","This account is not an administrator.")}
};
}

$("#ticket").onclick=openTicket;
async function openTicket(){
const u=await currentUser();
if(!u){open(`<label>RAVENOID // TICKET SYSTEM</label><h3>LOGIN REQUIRED</h3><p>Sign in to create a persistent private ticket and chat with an admin.</p><button class="btn primary" id="loginNow">LOGIN ↗</button>`);$("#loginNow").onclick=openAuth;return}
open(`<label>RAVENOID // TICKET SYSTEM</label><h3>CREATE A PRIVATE TICKET</h3>
<div class="form"><input id="tsub" placeholder="Subject"><select id="tcat"><option>General</option><option>Collaboration</option><option>Website</option><option>Support</option><option>Other</option></select>
<textarea id="tmsg" placeholder="Message"></textarea><button class="btn primary" id="sendTicket">CREATE TICKET ↗</button></div>`);
$("#sendTicket").onclick=async()=>{
 const subject=$("#tsub").value.trim(), body=$("#tmsg").value.trim();
 if(!subject||!body)return toast("MISSING DATA","Add a subject and message.");
 const {data:t,error}=await supabase.from("tickets").insert({user_id:u.id,subject,category:$("#tcat").value,status:"open"}).select().single();
 if(error)return toast("TICKET ERROR",error.message);
 const {error:e}=await supabase.from("ticket_messages").insert({ticket_id:t.id,sender_id:u.id,body});
 if(e)return toast("MESSAGE ERROR",e.message);
 close();toast("TICKET CREATED",`Ticket #${t.ticket_no} is now open.`);
};
}

async function openMyTickets(){
const u=await currentUser(); if(!u)return openAuth();
const {data:tickets,error}=await supabase.from("tickets").select("*").eq("user_id",u.id).order("updated_at",{ascending:false});
open(`<label>RAVENOID // MY TICKETS</label><h3>SUPPORT CHANNELS</h3>
<div id="ticketList">${error?`<p>${safe(error.message)}</p>`:(tickets||[]).map(t=>`<button class="btn ticket-row" data-id="${t.id}">#${t.ticket_no} — ${safe(t.subject)} — ${safe(t.status)}</button>`).join("")||"<p>No tickets yet.</p>"}</div>`);
$$(".ticket-row").forEach(b=>b.onclick=()=>openTicketChat(b.dataset.id));
}
async function openTicketChat(id){
const {data:t}=await supabase.from("tickets").select("*").eq("id",id).single();
const {data:m}=await supabase.from("ticket_messages").select("id,body,created_at,sender_id").eq("ticket_id",id).order("created_at");
open(`<label>RAVENOID // TICKET #${t.ticket_no}</label><h3>${safe(t.subject)}</h3>
<div id="chatLog" style="max-height:300px;overflow:auto">${(m||[]).map(x=>`<div style="padding:10px 0;border-bottom:1px solid #ffffff10"><small>${new Date(x.created_at).toLocaleString()}</small><p>${safe(x.body)}</p></div>`).join("")}</div>
<div class="form"><textarea id="reply" placeholder="Write a reply..."></textarea><button class="btn primary" id="sendReply">SEND ↗</button></div>`);
$("#sendReply").onclick=async()=>{
 const u=await currentUser(), body=$("#reply").value.trim(); if(!body)return;
 const {error}=await supabase.from("ticket_messages").insert({ticket_id:id,sender_id:u.id,body});
 if(error)toast("SEND FAILED",error.message);else{$("#reply").value="";toast("MESSAGE SENT","Your reply has been added.");}
};
supabase.channel(`ticket-${id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"ticket_messages",filter:`ticket_id=eq.${id}`},payload=>{
 const box=$("#chatLog"); if(!box)return; box.insertAdjacentHTML("beforeend",`<div style="padding:10px 0;border-bottom:1px solid #ffffff10"><small>${new Date(payload.new.created_at).toLocaleString()}</small><p>${safe(payload.new.body)}</p></div>`); box.scrollTop=box.scrollHeight;
}).subscribe();
}

$("#roomBtn").onclick=openRoom;
async function openRoom(){
if(!supabase){open(`<label>RAVENOID // PUBLIC ROOM</label><h3>COMMUNITY CHANNEL</h3><p>Configure Supabase to activate live posts and uploads.</p>`);return}
const {data:posts,error}=await supabase.from("public_posts").select("id,body,image_path,created_at,profiles(display_name)").order("created_at",{ascending:false}).limit(30);
open(`<label>RAVENOID // PUBLIC ROOM</label><h3>LIVE COMMUNITY</h3>
<div class="form"><textarea id="postBody" placeholder="Share a thought..."></textarea><input id="postImage" type="file" accept="image/*"><button class="btn primary" id="post">POST TO ROOM ↗</button>
<div>${error?`<p>${safe(error.message)}</p>`:(posts||[]).map(p=>`<div style="padding:12px 0;border-bottom:1px solid #ffffff10"><b>${safe(p.profiles?.display_name||"Anonymous")}</b><small style="display:block">${new Date(p.created_at).toLocaleString()}</small><p>${safe(p.body)}</p>${p.image_path?`<img src="${safe(p.image_path)}" style="max-width:100%;border-radius:12px">`:""}</div>`).join("")||"<p>No posts yet.</p>"}</div></div>`);
$("#post").onclick=async()=>{
 const u=await currentUser(); if(!u)return toast("LOGIN REQUIRED","Sign in to post.");
 const body=$("#postBody").value.trim(); if(!body)return toast("EMPTY POST","Write something first.");
 let image_path=null; const f=$("#postImage").files[0];
 if(f){
   const ext=(f.name.split(".").pop()||"jpg").toLowerCase(), path=`public/${u.id}/${crypto.randomUUID()}.${ext}`;
   const {error:e}=await supabase.storage.from(STORAGE_BUCKET).upload(path,f,{upsert:false,contentType:f.type});
   if(e)return toast("UPLOAD FAILED",e.message);
   const {data:pub}=supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path); image_path=pub.publicUrl;
 }
 const {error}=await supabase.from("public_posts").insert({user_id:u.id,body,image_path});
 if(error)toast("POST FAILED",error.message);else{close();toast("POST PUBLISHED","Your thought is now live.");}
};
}

$$(".work").forEach(x=>x.onclick=()=>open(`<label>RAVENOID // PROJECT</label><h3>${safe(x.dataset.project)}</h3><p>Project details can be managed from the protected Command Center.</p>`));

if(supabase){
 supabase.auth.onAuthStateChange((_event,session)=>{if(session)$("#account").textContent="ACCOUNT";});
 supabase.channel("ravenoid-notifications").on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications"},payload=>{
   toast("RAVENOID NOTIFICATION",payload.new.message);
 }).subscribe();
}
setTimeout(()=>toast("RAVENOID ONLINE",configured?"Backend connected.":"Frontend ready — configure Supabase to activate live features."),800);
