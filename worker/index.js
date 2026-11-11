const headers = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const json = (data, status=200) => Response.json(data,{status,headers});
const statuses = ["Interested","Applied","Interviewing","Offer","Rejected","Withdrawn"];
const stages = ["None","Recruiter call","Technical interview","Hiring-manager interview","Final interview","Awaiting decision","Final decision"];
const limits = {company:150,role:200,status:30,stage:40,contact:150,email:250,deadline:10,followup:10,location:150,mode:30,tech:500,notes:6000,track:40,production:4,done:4,oa:150,oaDue:10,oaState:30,interviewAt:16,otherDate:10,otherLabel:150,sourceId:40};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (Object.hasOwn(assets,path) && request.method === "GET") {
      const types = {"/":"text/html","/style.css":"text/css","/app.js":"text/javascript"};
      return new Response(assets[path],{headers:{...headers,"Content-Type":types[path]+"; charset=utf-8","Content-Security-Policy":"default-src 'self'; frame-ancestors 'self' https://chatgpt.com; base-uri 'none'"}});
    }
    if (path !== "/api/applications") return json({error:"Page not found"},404);
    try {
      if (request.method === "GET") {
        const {results} = await env.DB.prepare("SELECT id,data,updated_at FROM applications ORDER BY updated_at DESC").all();
        return json(results.map(({id,data,updated_at})=>({...JSON.parse(data),id,updated:updated_at})));
      }
      if (request.headers.get("Origin") !== url.origin) return json({error:"Invalid origin"},403);
      if (request.method === "PATCH") {
        const id = url.searchParams.get("id") ?? "";
        if (!/^[0-9a-f-]{36}$/.test(id) || url.searchParams.get("clear") !== "assessment") {
          return json({error:"Invalid assessment request."},400);
        }
        const row = await env.DB.prepare(
          "UPDATE applications SET data=json_remove(data,'$.oa','$.oaDue','$.oaState'), updated_at=? WHERE id=? RETURNING id,data,updated_at"
        ).bind(new Date().toISOString(),id).first();
        if (!row) return json({error:"Application no longer exists."},404);
        return json({...JSON.parse(row.data),id:row.id,updated:row.updated_at});
      }
      if (request.method === "DELETE") {
        const id = url.searchParams.get("id") ?? "";
        await env.DB.prepare("DELETE FROM applications WHERE id=?").bind(id).run();
        return json({ok:true});
      }
      if (request.method !== "POST") return json({error:"Method not allowed"},405);
      const body = await request.json().catch(()=>null);
      if (!body || !/^[0-9a-f-]{36}$/.test(body.id ?? "")) return json({error:"Invalid application"},400);
      const data = Object.fromEntries(Object.entries(limits).map(([key,max])=>[key,typeof body[key]==="string" ? body[key].trim().slice(0,max) : ""]));
      if (!data.company || !data.role || !statuses.includes(data.status) || !stages.includes(data.stage)) return json({error:"Check the company, role, status, and stage."},400);
      for (const key of ["deadline","followup","oaDue","otherDate"]) if(data[key] && !/^\d{4}-\d{2}-\d{2}$/.test(data[key])) return json({error:"Invalid date."},400);
      if(data.interviewAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(data.interviewAt)) return json({error:"Invalid interview date."},400);
      const now = new Date().toISOString();
      await env.DB.prepare("INSERT INTO applications (id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at").bind(body.id,JSON.stringify(data),now).run();
      return json({...data,id:body.id,updated:now});
    } catch {
      return json({error:"Couldn’t access your applications. Please try again."},503);
    }
  }
};
