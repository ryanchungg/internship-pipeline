"use strict";
const $ = (id) => document.getElementById(id);
const statuses = ["Interested","Applied","Interviewing","Offer","Rejected","Withdrawn"];
const stages = ["None","Recruiter call","Technical interview","Hiring-manager interview","Final interview","Awaiting decision","Final decision"];
const tracks = ["Web","Full-stack","Backend","C++ / Systems","Other"];
const modes = ["Remote","Hybrid","On-site","Unspecified"];
const titles = {dashboard:"Dashboard",compare:"Compare roles",assessments:"Online assessments",calendar:"Calendar",templates:"Templates",inbox:"Email import"};
const filters = {q:"",status:"",stage:"",track:"",mode:"",sort:"fit"};
let view = "dashboard", entries = [], editing, loading = true, loadError = "", toastTimer, saving = false;
const selected = new Set();
const compareFilters = {q:"",mode:"",sort:"company"};
const compareSorts = {company:"Company A–Z",location:"Location A–Z",mode:"Work arrangement",fit:"Best fit",deadline:"Application deadline",recent:"Recently updated"};
const closed = (r) => ["Rejected","Withdrawn"].includes(r.status);
const dateToday = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Detroit",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const plusWeek = () => {const d = new Date(dateToday()+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+7);return d.toISOString().slice(0,10);};
const fmt = (d) => d ? new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(d+"T12:00:00Z")) : "—";
const e = (value) => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const opts = (values, current) => values.map(v=>'<option'+(v===current?' selected':'')+'>'+e(v)+'</option>').join("");
const badge = (s) => '<span class="pill '+e(s.toLowerCase())+'">'+e(s)+'</span>';
const button = (name, action, cls="secondary", id="") => '<button type="button" class="'+cls+'" data-action="'+action+'" data-id="'+e(id)+'">'+name+'</button>';
const empty = (icon,title,desc,action="") => '<div class="empty"><span class="mark" aria-hidden="true">'+icon+'</span><h3>'+title+'</h3><p class="muted">'+desc+'</p>'+action+'</div>';
const section = (kicker,title,desc) => '<div class="section-head"><div><div class="eyebrow">'+kicker+'</div><h1>'+title+'</h1><p>'+desc+'</p></div></div>';
const matchGroups = [/\breact\b/i,/\b(?:javascript|typescript|js|ts)\b/i,/\bpython\b/i,/\b(?:sql|postgres(?:ql)?|mysql|sqlite)\b/i,/\b(?:rest|apis?|graphql)\b/i];
const fit = (r) => (["Web","Full-stack"].includes(r.track)?4:0)+matchGroups.filter(p=>p.test(r.tech)).length+(r.production==="yes"?2:0);
const pendingOA = (r) => !closed(r) && (r.oa || r.oaDue) && !["Completed","Expired"].includes(r.oaState);
const byDate = (a,b,key) => (a[key]||"9999").localeCompare(b[key]||"9999");
const rowsForView = () => entries.filter(r=>{
  const searchable = [r.company,r.role,r.contact,r.email,r.tech,r.location,r.notes].join(" ").toLowerCase();
  return searchable.includes(filters.q.toLowerCase().trim()) && ["status","stage","track","mode"].every(k=>!filters[k] || filters[k]===r[k]);
}).sort((a,b)=>{
  if(filters.sort==="company") return a.company.localeCompare(b.company);
  if(filters.sort==="deadline") return byDate(a,b,"deadline");
  if(filters.sort==="recent") return b.updated.localeCompare(a.updated);
  return fit(b)-fit(a) || a.company.localeCompare(b.company);
});
function notify(message) {
  $("toast").textContent=message;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$("toast").textContent="",3500);
}
async function api(method="GET",data) {
  const path = "/api/applications"+(method==="DELETE"||method==="PATCH"?"?id="+encodeURIComponent(data):"")+(method==="PATCH"?"&clear=assessment":"");
  const response = await fetch(path,{method,...(method==="POST"?{headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}:{})});
  const body = await response.json().catch(()=>null);
  if (!response.ok || body===null) throw new Error(body?.error || "The request failed. Try again.");
  return body;
}
async function load() {
  loading=true;loadError="";render();
  try {entries=await api();}
  catch(err){loadError=err.message;}
  finally {loading=false;render();}
}
async function save(record) {
  const result=await api("POST",record);
  entries=[result,...entries.filter(x=>x.id!==result.id)];
  return result;
}
function render() {
  $("crumb").textContent=titles[view];
  document.querySelectorAll("[data-view]").forEach(b=>{
    b.classList.toggle("active",b.dataset.view===view);
    if(b.dataset.view===view) b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
  const alert = loadError?'<div class="banner">'+e(loadError)+' '+button("Retry","retry")+'</div>':"";
  const pages={dashboard,compare,assessments,calendar,templates,inbox};
  $("page").innerHTML=alert+pages[view]();
  if($("resultCount")) $("resultCount").textContent=rowsForView().length+" of "+entries.length+" roles";
  if(view==="templates") draft();
}
const filterMenu=(key,label,list)=>'<select data-filter="'+key+'" aria-label="'+label+'"><option value="">'+label+'</option>'+opts(list,filters[key])+'</select>';
function dashboard() {
  const metrics=[["▤","Tracked roles",entries.length,"All application records","all"],["◈","Interviewing",entries.filter(r=>r.status==="Interviewing").length,"Active interview loops","interview"],["✓","Offers",entries.filter(r=>r.status==="Offer").length,"Offers received","offer"],["◷","Open assessments",entries.filter(pendingOA).length,"Online assessments to complete","assessments"]];
  const next=entries.filter(pendingOA).sort((a,b)=>byDate(a,b,"oaDue")).slice(0,3);
  const deadlines=entries.filter(r=>!closed(r)&&r.deadline>=dateToday()&&r.deadline<=plusWeek()).sort((a,b)=>byDate(a,b,"deadline")).slice(0,4);
  return '<section class="hero"><div><div class="eyebrow">RECRUITING WORKSPACE</div><h1>Internship pipeline</h1><p>Track applications, compare roles, and stay on top of the next step.</p></div>'+button("＋ Add application","new","primary")+'</section>'
  +'<div class="metrics">'+metrics.map(([icon,name,count,detail,action])=>'<button class="metric" data-action="'+action+'"><i aria-hidden="true">'+icon+'</i><span>'+name+'</span><strong>'+count+'</strong><span>'+detail+'</span></button>').join("")+'</div>'
  +'<div class="columns"><section class="card"><div class="card-head"><div><h2>Applications</h2><p id="resultCount"></p></div>'+button('Compare <span id="compareCount">'+selected.size+'</span>',"compare")+'</div><div class="toolbar"><input data-filter="q" aria-label="Search applications" placeholder="Search company, role, tech…" value="'+e(filters.q)+'">'+filterMenu("status","All statuses",statuses)+filterMenu("stage","All stages",stages)+filterMenu("track","All tracks",tracks)+filterMenu("mode","All locations",modes)+'<select data-filter="sort" aria-label="Sort applications">'+Object.entries({fit:"Best fit",recent:"Recently updated",deadline:"Deadline",company:"Company A–Z"}).map(([k,v])=>'<option value="'+k+'"'+(k===filters.sort?' selected':'')+'>'+v+'</option>').join("")+'</select></div><div id="results" class="tablewrap">'+applicationTable()+'</div></section>'
  +'<div class="rail"><section class="card"><div class="card-head"><h2>Online assessments</h2></div><div class="rail-body">'+(next.length?next.map(r=>'<div class="rail-row"><strong>'+e(r.company)+'</strong><span>'+fmt(r.oaDue)+'</span></div>').join(""):'<p class="muted">Add an assessment to a role to see it here.</p>')+'<div class="tags">'+button("View assessments →","assessments")+'</div></div></section>'
  +'<section class="card"><div class="card-head"><h2>Deadlines · next 7 days</h2></div><div class="rail-body">'+(deadlines.length?deadlines.map(r=>'<div class="rail-row"><strong>'+e(r.company)+'</strong><span>'+fmt(r.deadline)+'</span></div>').join(""):'<p class="muted">No upcoming application deadlines.</p>')+'</div></section>'
  +'<section class="card"><div class="card-head"><h2>Your role priorities</h2></div><div class="rail-body"><p class="muted">Best fit favors web and full-stack work, matching technologies, and production codebases. Track C++ roles alongside them.</p><div class="tags">'+["React","JavaScript","TypeScript","Python","SQL","APIs","C++"].map(x=>'<span>'+x+'</span>').join("")+'</div></div></section></div></div>';
}
function applicationTable() {
  const rows=rowsForView();
  if(loading) return empty("◷","Loading applications","Retrieving your saved records.");
  if(loadError) return empty("!","Applications unavailable","Retry to load your records.");
  const table = '<table><thead><tr><th>Pick</th><th>Company / Role</th><th>Status / Stage</th><th>Location / Stack</th><th>Deadline</th><th>Contact</th><th></th></tr></thead>';
  const body = rows.map(r=>'<tr><td><input type="checkbox" data-pick="'+e(r.id)+'" aria-label="Compare '+e(r.company+' '+r.role)+'" '+(selected.has(r.id)?'checked':'')+'></td><td><div class="entity">'+e(r.company)+'</div><div class="sub">'+e(r.role)+'</div></td><td>'+badge(r.status)+'<div class="sub">'+e(r.stage==="None"?"":r.stage)+'</div></td><td>'+e([r.location,r.mode==="Unspecified"?"":r.mode].filter(Boolean).join(" · ")||"—")+'<div class="sub">'+e(r.tech)+'</div></td><td>'+fmt(r.deadline)+'</td><td>'+e(r.contact||r.email||"—")+'</td><td>'+button("Edit","edit","secondary",r.id)+'</td></tr>').join("");
  if(rows.length) return table+'<tbody>'+body+'</tbody></table>';
  if(entries.length) return table+'</table>'+empty("⌕","No matching applications","Clear the filters to see all your roles.",button("Clear filters","all"));
  return table+'</table>'+empty("▤","Start with your first application","Add a role to track its progress, or review an application update from email.",button("Add application","new","primary")+" "+button("Review email","inbox"));
}
const roleLocation = r => [r.location,r.mode==="Unspecified"?"":r.mode].filter(Boolean).join(" · ");
function compareResults() {
  const terms = compareFilters.q.trim().toLowerCase().split(/\s+/);
  const rows = entries.filter(r=>{
    const text = [r.company,r.role,roleLocation(r),r.tech,r.status].join(" ").toLowerCase();
    return (!compareFilters.mode || r.mode===compareFilters.mode) && terms.every(term=>text.includes(term));
  }).sort((a,b)=>{
    const company = a.company.localeCompare(b.company) || a.role.localeCompare(b.role);
    if(compareFilters.sort==="location") return Number(!roleLocation(a))-Number(!roleLocation(b)) || roleLocation(a).localeCompare(roleLocation(b)) || company;
    if(compareFilters.sort==="mode") return (a.mode||"Unspecified").localeCompare(b.mode||"Unspecified") || company;
    if(compareFilters.sort==="fit") return fit(b)-fit(a) || company;
    if(compareFilters.sort==="deadline") return byDate(a,b,"deadline") || company;
    if(compareFilters.sort==="recent") return b.updated.localeCompare(a.updated) || company;
    return company;
  });
  return rows.length?rows.map(r=>'<label class="compare-option"><input type="checkbox" data-pick="'+e(r.id)+'" '+(selected.has(r.id)?'checked':'')+'><span><strong>'+e(r.company)+'</strong><span class="sub"> · '+e(r.role)+'</span></span><span class="sub">'+e(roleLocation(r)||"Location unspecified")+'</span></label>').join(""):empty("⌕","No matching roles","Try another search or work arrangement.");
}
function compareSelection() {
  const picks=Array.from(selected,id=>entries.find(r=>r.id===id)).filter(Boolean);
  const fields=[["Track",r=>r.track],["Fit score",fit],["Status",r=>r.status],["Interview stage",r=>r.stage],["Location",roleLocation],["Technologies",r=>r.tech],["Production codebase",r=>r.production==="yes"?"Yes":"Unspecified"],["Deadline",r=>fmt(r.deadline)],["OA due",r=>fmt(r.oaDue)],["Recruiter",r=>[r.contact,r.email].filter(Boolean).join("\n")],["Notes",r=>r.notes]];
  return '<p class="muted" role="status">'+picks.length+' of 4 roles selected</p>'
    +(picks.length?'<div class="tablewrap"><table class="compare-table"><thead><tr><th>Role details</th>'+picks.map(r=>'<th>'+e(r.company)+'<div class="sub">'+e(r.role)+'</div>'+button("Remove","unpick","secondary",r.id)+'</th>').join("")+'</tr></thead><tbody>'+fields.map(([name,get])=>'<tr><td>'+name+'</td>'+picks.map(r=>'<td>'+e(get(r)??"—")+'</td>').join("")+'</tr>').join("")+'</tbody></table></div>':empty("◫","Choose roles","Select applications above to see them side by side."));
}
function compare() {
  const controls = '<div class="toolbar"><input type="search" data-compare="q" aria-label="Search roles to compare" placeholder="Search company, role, location, or tech…" value="'+e(compareFilters.q)+'"><select data-compare="mode" aria-label="Work arrangement"><option value="">All work arrangements</option>'+opts(modes,compareFilters.mode)+'</select><select data-compare="sort" aria-label="Sort roles">'+Object.entries(compareSorts).map(([key,label])=>'<option value="'+key+'"'+(key===compareFilters.sort?' selected':'')+'>'+label+'</option>').join("")+'</select></div>';
  return section("ROLE SHORTLIST","Compare roles","Search and select up to four applications to compare side by side.")
    +(!entries.length?'<div class="card">'+empty("◫","Add roles to compare","Your saved applications will appear here.",button("Add application","new","primary"))+'</div>':'<div class="card padded">'+controls+'<div id="compareResults" class="compare-results">'+compareResults()+'</div><div id="compareSelection">'+compareSelection()+'</div></div>');
}
function assessments() {
  const roles=entries.filter(r=>r.oa||r.oaDue||r.oaState).sort((a,b)=>byDate(a,b,"oaDue"));
  return section("HIRING STEPS","Online assessments","Track take-home tests, coding challenges, and recorded assessments.")
    +'<section class="card"><div class="card-head"><h2>Assessment tracker</h2></div>'
    +(roles.length?roles.map(r=>'<div class="reminder padded"><div><h3>'+e(r.company)+' · '+e(r.oa||"Online assessment")+'</h3><div class="sub">'+e(r.role)+' · '+(r.oaDue?fmt(r.oaDue):"Due date unknown")+'</div><div class="sub">'+e(r.oaState||"Pending")+(pendingOA(r)&&r.oaDue&&r.oaDue<dateToday()?" · Overdue":"")+'</div></div>'+'<div class="assessment-actions">'+button("Edit","edit","secondary",r.id)+button("Delete assessment","deleteOA","danger",r.id)+'</div>'+'</div>').join(""):empty("◷","No assessments yet","Edit an application to add its assessment and due date."))+'</section>';
}
let calendarMonth = dateToday().slice(0,7);
const calendarEvents = () => entries.flatMap(r=>[
  {day:r.deadline,label:"Application deadline",kind:"deadline"},
  {day:r.oaDue,label:r.oa||"Online assessment due",kind:"oa"},
  {day:r.interviewAt?.slice(0,10),label:r.stage==="None"?"Interview":r.stage,kind:"interview",time:r.interviewAt?.slice(11)},
  {day:r.otherDate,label:r.otherLabel||"Other deadline",kind:"deadline"}
].filter(x=>x.day).map(x=>({...x,role:r}))).sort((a,b)=>a.day.localeCompare(b.day)||(a.time||"").localeCompare(b.time||""));
function calendar() {
  const first = new Date(calendarMonth+"-01T12:00:00Z");
  const count = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  const events = calendarEvents().filter(x=>x.day.startsWith(calendarMonth));
  const month = new Intl.DateTimeFormat("en-US",{month:"long",year:"numeric",timeZone:"UTC"}).format(first);
  const cell = day => {
    const date = calendarMonth+"-"+String(day).padStart(2,"0");
    return '<div class="day'+(date===dateToday()?' today':'')+'"><strong>'+day+'</strong>'+events.filter(x=>x.day===date).map(x=>'<button type="button" class="event '+x.kind+'" data-action="edit" data-id="'+e(x.role.id)+'" title="'+e(x.label)+'">'+e(x.role.company)+' · '+e(x.label)+'</button>').join("")+'</div>';
  };
  return section("RECRUITING SCHEDULE","Calendar","Interviews, assessment due dates, and other application deadlines. Interview times use Eastern time.")
    +'<section class="card"><div class="card-head"><h2>'+month+'</h2><div>'+button("‹ Previous","prevMonth")+' '+button("Today","thisMonth")+' '+button("Next ›","nextMonth")+'</div></div><div class="tablewrap"><div class="monthgrid">'
    +["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>'<div class="weekday">'+d+'</div>').join("")
    +'<div class="day blank"></div>'.repeat(first.getUTCDay())+Array.from({length:count},(_,i)=>cell(i+1)).join("")+'</div></div></section>'
    +'<section class="card agenda"><div class="card-head"><h2>'+month+' agenda</h2></div>'
    +(events.length?events.map(x=>'<div class="reminder padded"><div><h3>'+e(x.role.company)+' · '+e(x.label)+'</h3><div class="sub">'+fmt(x.day)+(x.time?' · '+e(x.time)+' ET':'')+' · '+e(x.role.role)+'</div></div>'+button("Edit","edit","secondary",x.role.id)+'</div>').join(""):empty("▦","No events this month","Add a date to an application or browse another month."))+'</section>';
}
const stories={
  "Shield AI · Duplicate data":"During my Shield AI internship, I identified and fixed a duplicate-data issue. That experience taught me to trace unexpected results back to their source and verify that the fix addresses the underlying cause.",
  "Shield AI · Claude Code adoption":"During my Shield AI internship, I spearheaded Claude Code adoption at NSOFT by adding project-specific context. I learned how to introduce a new tool in a way that fits an existing engineering workflow.",
  "Chat485 · Full-stack development":"In Chat485, I worked across a React frontend, Flask APIs, and a SQL database. I learned to follow behavior from the user interface through the API and into the database.",
  "EECS 370 · Low-level roles":"I built a two-pass LC-2K assembler in C, separating symbol collection from instruction encoding. The project gave me practice reasoning about machine instructions, symbol resolution, and edge cases."
};
const roleOptions = (blank) => '<option value="">'+blank+'</option>'+entries.map(r=>'<option value="'+e(r.id)+'">'+e(r.company+" · "+r.role)+'</option>').join("");
function templates() {
  return section("OUTREACH TOOLKIT","Templates","Customize a draft using a saved role and an experience that fits the prompt.")
    +'<div class="split"><section class="card padded template-tools"><label>Template <select id="templateKind"><option>Recruiter follow-up</option><option>Interview thank-you</option><option>Why this internship?</option><option>Technical challenge</option></select></label><label>Role <select id="templateRole">'+roleOptions("Use placeholders")+'</select></label><label>Experience <select id="templateStory">'+opts(Object.keys(stories),Object.keys(stories)[0])+'</select></label><label for="draft">Editable draft</label><textarea id="draft" class="draft"></textarea>'+button("Copy draft","copy","primary")+'</section><section class="card padded"><h2>Experience bank</h2><p class="muted">Lead with internship accomplishments. Use Chat485 for full-stack examples and save the assembler for roles that call for low-level work.</p>'+Object.entries(stories).map(([name,desc])=>'<div class="story"><h3>'+e(name)+'</h3><p class="muted">'+e(desc)+'</p></div>').join("")+'</section></div>';
}
function draft() {
  const r=entries.find(x=>x.id===$("templateRole").value);
  const company=r?.company||"[Company]", role=r?.role||"[Role]", contact=r?.contact||"[Name]";
  const story=stories[$("templateStory").value];
  const focus=r?.track==="C++ / Systems"?"the chance to work on a C++ codebase and learn how the team handles performance and correctness":"the chance to work on a production codebase and follow features from the API through to the user experience";
  const drafts={
    "Recruiter follow-up":"Subject: Following up on the "+role+" opportunity\n\nHi "+contact+",\n\nI wanted to follow up on my application for the "+role+" position at "+company+". I’m still interested in the opportunity and would appreciate any update you can share about the timeline or next steps.\n\nThanks,\nRyan Chung",
    "Interview thank-you":"Subject: Thank you for your time\n\nHi "+contact+",\n\nThanks for speaking with me about the "+role+" position at "+company+". I enjoyed hearing about [specific topic from your conversation]. Our conversation made me even more interested in how the team approaches [related engineering challenge].\n\nThanks again,\nRyan Chung",
    "Why this internship?":"I’m interested in the "+role+" position at "+company+" because of "+focus+". I’d especially like to contribute to [specific team project or product].\n\n"+story+" I’d like to bring that experience to this team while learning how it ships and supports features in production.",
    "Technical challenge":story+"\n\nThe hardest part was [specific constraint]. I chose [approach] because [tradeoff], then checked the result by [test or verification]. The outcome was [verified result]."
  };
  $("draft").value=drafts[$("templateKind").value].replaceAll(";",".");
}
function inbox() {
  return section("APPLICATION UPDATES","Email import","Review a confirmation, interview invitation, or decision from your inbox.")
    +'<div class="banner"><strong>Gmail import</strong><p>ChatGPT can import updates using your connected Gmail. To review a message directly here, paste it below.</p></div><section class="card padded"><form id="importForm" class="importform"><label>Match a saved role<select name="match">'+roleOptions("Create a new application")+'</select></label><label>Email subject<input name="subject" required maxlength="500" placeholder="Example: Invitation to a technical interview"></label><label>Email excerpt<textarea name="excerpt" maxlength="4000" placeholder="Paste the relevant lines from the email"></textarea></label><div><button class="primary">Review update</button></div></form></section>';
}
function readEmail(form) {
  const f=new FormData(form), subject=f.get("subject").trim(), excerpt=f.get("excerpt").trim(), text=subject+"\n"+excerpt;
  const original=entries.find(x=>x.id===f.get("match"));
  const decision=/moving forward with other|unfortunately|will not be moving|not (?:be )?(?:selected|moving forward)|regret to inform|\brejection\b|pursue other candidates/i.test(text);
  const offer=/offer letter|pleased to offer|extend (?:you )?an offer/i.test(text);
  const interview=/\binterview\b|recruiter (?:call|screen)|phone screen|hiring manager call|schedule (?:a|an|your) (?:call|conversation)/i.test(text);
  const applied=/application (?:received|submitted|confirmation)|thank you for (?:applying|your application)|received your application|successfully applied/i.test(text);
  let status=original?.status||"Interested", stage=original?.stage||"None";
  if(decision||offer) {status=decision?"Rejected":"Offer";stage="Final decision";}
  else if(interview) {
    status="Interviewing";
    if(/final (?:round|interview)/i.test(text)) stage="Final interview";
    else if(/hiring[- ]manager/i.test(text)) stage="Hiring-manager interview";
    else if(/technical|coding/i.test(text)) stage="Technical interview";
    else if(/recruiter|phone screen|introductory/i.test(text)) stage="Recruiter call";
  } else if(applied&&(!original||status==="Interested")) status="Applied";
  const notes=[original?.notes,"Email subject: "+subject].filter(Boolean).join("\n\n");
  openEditor({...original,status,stage,notes},"Review email update");
  $("formError").textContent="Verify the application and proposed status before saving. Only the subject is added to notes.";
}
function openEditor(record={},title) {
  editing={...record,id:record.id||crypto.randomUUID()};
  $("editTitle").textContent=title||(record.id?"Edit application":"Add application");
  $("formError").textContent="";
  $("remove").hidden=!record.id;
  const input=(key,label,type="text",extra="")=>'<label>'+label+'<input name="'+key+'" type="'+type+'" value="'+e(record[key]||"")+'" '+extra+'></label>';
  const select=(key,label,list)=>'<label>'+label+'<select name="'+key+'">'+opts(list,record[key]||list[0])+'</select></label>';
  $("fields").innerHTML=input("company","Company","text","required maxlength=150")+input("role","Role","text","required maxlength=200")
    +select("status","Application status",statuses)+select("stage","Interview stage",stages)
    +select("track","Role track",["Other",...tracks.filter(x=>x!=="Other")])+select("mode","Work arrangement",["Unspecified",...modes.filter(x=>x!=="Unspecified")])
    +input("location","Location")+input("tech","Technologies (comma-separated)")
    +input("contact","Recruiter name")+input("email","Recruiter email","email")
    +input("deadline","Application deadline","date")+input("interviewAt","Interview date and time (ET)","datetime-local")
    +input("oa","Online assessment")+input("oaDue","Assessment due date","date")
    +select("oaState","Assessment status",["","Pending","Completed","Expired"])+input("otherDate","Other deadline","date")+input("otherLabel","Other deadline label")
    +'<label><span><input name="production" type="checkbox" value="yes" '+(record.production==="yes"?"checked":"")+'> Production codebase</span></label>'
    +(record.sourceId&&/^[a-f0-9]+$/.test(record.sourceId)?'<div class="wide"><a href="https://mail.google.com/mail/u/0/#all/'+e(record.sourceId)+'" target="_blank" rel="noopener">View source email in Gmail ↗</a></div>':"")
    +'<label class="wide">Notes<textarea name="notes" maxlength="6000">'+e(record.notes)+'</textarea></label>';
  $("editor").showModal();
}
function navigate(next) {view=next;render();window.scrollTo(0,0);}
function syncTable() {
  if($("results")) $("results").innerHTML=applicationTable();
  if($("resultCount")) $("resultCount").textContent=rowsForView().length+" of "+entries.length+" roles";
  if($("compareCount")) $("compareCount").textContent=selected.size;
}
document.addEventListener("input",event=>{
  const key=event.target.dataset.filter;
  if(key) {filters[key]=event.target.value;syncTable();}
  const compareKey=event.target.dataset.compare;
  if(compareKey) {
    compareFilters[compareKey]=event.target.value;
    $("compareResults").innerHTML=compareResults();
    $("compareResults").scrollTop=0;
  }
});
document.addEventListener("change",event=>{
  const pick=event.target.dataset.pick;
  if(pick) {
    if(event.target.checked&&selected.size>=4) {event.target.checked=false;notify("Choose up to four roles.");return;}
    if(event.target.checked) selected.add(pick);else selected.delete(pick);
    if(view==="compare") $("compareSelection").innerHTML=compareSelection();else syncTable();
  }
  if(["templateKind","templateRole","templateStory"].includes(event.target.id)) draft();
});
document.addEventListener("click",async event=>{
  const nav=event.target.closest("[data-view]");
  if(nav) return navigate(nav.dataset.view);
  const btn=event.target.closest("[data-action]");
  if(!btn) return;
  const {action,id}=btn.dataset, record=entries.find(r=>r.id===id);
  if(action==="unpick") {
    selected.delete(id);
    const input = Array.from($("compareResults").querySelectorAll("[data-pick]")).find(item=>item.dataset.pick===id);
    if(input) input.checked=false;
    $("compareSelection").innerHTML=compareSelection();
    (input||document.querySelector('[data-compare="q"]')).focus();
    return;
  }
  if(action==="deleteOA" && record && !saving) {
    if(!confirm("Delete the assessment for "+record.company+"? Its application will be kept.")) return;
    saving=true;btn.disabled=true;
    try {
      const updated=await api("PATCH",id);
      entries=entries.map(r=>r.id===id?updated:r);
      render();notify("Assessment deleted.");
    } catch(err) {notify(err.message);}
    finally {saving=false;btn.disabled=false;}
    return;
  }
  if(action==="new") return openEditor();
  if(action==="edit"&&record) return openEditor(record);
  if(action==="close"&&!saving) return $("editor").close();
  if(action==="retry") return load();
  if(["compare","assessments","calendar","inbox"].includes(action)) return navigate(action);
  if(["prevMonth","thisMonth","nextMonth"].includes(action)) {
    const date=new Date(calendarMonth+"-01T12:00:00Z");
    date.setUTCMonth(date.getUTCMonth()+(action==="prevMonth"?-1:1));
    calendarMonth=action==="thisMonth"?dateToday().slice(0,7):date.toISOString().slice(0,7);
    render();return;
  }
  if(["all","interview","offer"].includes(action)) {
    Object.assign(filters,{q:"",status:action==="interview"?"Interviewing":action==="offer"?"Offer":"",stage:"",track:"",mode:""});
    render();return;
  }
  if(action==="copy"){
    try {await navigator.clipboard.writeText($("draft").value.replaceAll(";","."));notify("Draft copied.");}
    catch {$("draft").select();notify("Select and copy the draft.");}
    return;
  }
  if(action==="delete"&&!saving&&confirm("Delete this application?")) {
    saving=true;btn.disabled=true;
    try {await api("DELETE",editing.id);entries=entries.filter(r=>r.id!==editing.id);selected.delete(editing.id);$("editor").close();render();notify("Application deleted.");}
    catch(err){$("formError").textContent=err.message;}
    finally{saving=false;btn.disabled=false;}
  }

});
document.addEventListener("submit",async event=>{
  event.preventDefault();
  if(event.target.id==="importForm") return readEmail(event.target);
  if(event.target.id!=="entryForm"||saving) return;
  const submit=event.submitter;
  const data=Object.fromEntries(new FormData(event.target));
  saving=true;submit.disabled=true;$("formError").textContent="";
  try {await save({...editing,...data,production:data.production||""});$("editor").close();if(view==="inbox")navigate("dashboard");else render();notify("Application saved.");}
  catch(err){$("formError").textContent=err.message;}
  finally{saving=false;submit.disabled=false;}
});
$("editor").addEventListener("cancel",event=>{if(saving)event.preventDefault();});
load();
