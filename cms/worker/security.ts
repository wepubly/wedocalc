import { Env, HttpError } from "./types";
export const cookieName = "metricpedia_editorial_session";
export const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
export const randomToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function configured(env: Env, url: URL) {
  if (!env.DB || !env.MEDIA || !["staging", "local", "production-lab"].includes(env.ENVIRONMENT))
    throw new HttpError(503, "Ambiente editorial não configurado.");
  if (
    env.ENVIRONMENT === "staging" &&
    (url.protocol !== "https:" ||
      !/^metricpedia-cms-staging\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname))
  )
    throw new HttpError(503, "Origem de homologação inválida.");
  if (
    env.ENVIRONMENT === "production-lab" &&
    (url.protocol !== "https:" || !/^metricpedia-editorial-lab\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname))
  ) throw new HttpError(503,"Origem do laboratório inválida.");
  if (
    env.ENVIRONMENT === "local" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new HttpError(503, "Ambiente local inválido.");
}
export function checkOrigin(r: Request) {
  if (
    r.headers.get("origin") !== new URL(r.url).origin ||
    !["same-origin", "none", null].includes(r.headers.get("sec-fetch-site"))
  )
    throw new HttpError(403, "Origem inválida.");
}
export async function readBody(r: Request, limit: number) {
  if (Number(r.headers.get("content-length") || 0) > limit)
    throw new HttpError(413, "Conteúdo muito grande.");
  const reader = r.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Conteúdo muito grande.");
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
export async function jsonBody(r: Request) {
  if (!r.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use JSON.");
  try {
    const d = JSON.parse(new TextDecoder().decode(await readBody(r, 180000)));
    if (!d || typeof d !== "object" || Array.isArray(d)) throw Error();
    return d as Record<string, unknown>;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(400, "JSON inválido.");
  }
}
export function cookie(
  token: string,
  local: boolean,
  expired = false,
  maxAge = 604800,
) {
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${expired ? 0 : maxAge}${local ? "" : "; Secure"}`;
}
type Owner = {
  username: string;
  salt: string;
  password_hash: string;
  iterations: number;
  epoch: number;
};
export const owner = (e: Env) =>
  e.DB.prepare("SELECT * FROM owner WHERE id=1").first<Owner>();
async function derive(password: string, salt: string, iterations = 100000) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: new TextEncoder().encode(salt),
          iterations,
        },
        key,
        256,
      ),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
function validPassword(d: Record<string, unknown>) {
  if (
    typeof d.password !== "string" ||
    d.password.length < 12 ||
    d.password.length > 256
  )
    throw new HttpError(400, "Escolha uma senha de 12 a 256 caracteres.");
  if (
    typeof d.username !== "string" ||
    !/^[a-zA-Z0-9@._-]{3,100}$/.test(d.username)
  )
    throw new HttpError(400, "Usuário inválido.");
}
export async function throttle(r: Request, e: Env) {
  const id = await hash(r.headers.get("cf-connecting-ip") || "local");
  const t = Date.now(),
    cut = t - 900000;
  await e.DB.prepare(
    `INSERT INTO login_limits VALUES(?,?,1) ON CONFLICT(identity) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END`,
  )
    .bind(id, t, cut, cut)
    .run();
  const row = await e.DB.prepare(
    "SELECT attempts FROM login_limits WHERE identity=?",
  )
    .bind(id)
    .first<{ attempts: number }>();
  if ((row?.attempts || 0) > 10)
    throw new HttpError(429, "Muitas tentativas; aguarde 15 minutos.");
}
export async function setup(r: Request, e: Env) {
  checkOrigin(r);
  await throttle(r, e);
  if (await owner(e)) throw new HttpError(409, "Administrador já configurado.");
  if (!e.SETUP_TOKEN || e.SETUP_TOKEN.length < 24)
    throw new HttpError(
      503,
      "Configuração inicial bloqueada. Configure METRICPEDIA_SETUP_TOKEN no GitHub.",
    );
  const d = await jsonBody(r);
  if (
    typeof d.setupToken !== "string" ||
    (await hash(d.setupToken)) !== (await hash(e.SETUP_TOKEN))
  )
    throw new HttpError(403, "Chave de configuração inválida.");
  validPassword(d);
  const salt = randomToken();
  await e.DB.prepare(
    "INSERT INTO owner(id,username,salt,password_hash,iterations,epoch) VALUES(1,?,?,?,?,1)",
  )
    .bind(d.username, salt, await derive(d.password as string, salt), 100000)
    .run();
  return Response.json({ ok: true });
}
export async function session(r: Request, e: Env) {
  const token = r.headers
    .get("cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = await hash(token);
  return (await e.DB.prepare(
    "SELECT s.token_hash FROM sessions s JOIN owner o ON o.id=1 AND o.epoch=s.epoch WHERE s.token_hash=? AND s.expires_at>?",
  )
    .bind(key, Date.now())
    .first())
    ? key
    : null;
}
export async function login(r: Request, e: Env) {
  await throttle(r, e);
  const d = await jsonBody(r),
    o = await owner(e);
  const salt = o?.salt || "dummy-salt";
  const actual = await derive(
    typeof d.password === "string" ? d.password : "",
    salt,
  );
  if (!o || d.username !== o.username || actual !== o.password_hash)
    throw new HttpError(401, "Usuário ou senha inválidos.");
  const token = randomToken();
  await e.DB.batch([
    e.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(Date.now()),
    e.DB.prepare(
      "INSERT INTO sessions(token_hash,expires_at,epoch) VALUES(?,?,?)",
    ).bind(await hash(token), Date.now() + 604800000, o.epoch),
  ]);
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": cookie(token, e.ENVIRONMENT === "local"),
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function changePassword(r: Request, e: Env) {
  const d = await jsonBody(r),
    o = await owner(e);
  if (
    !o ||
    typeof d.currentPassword !== "string" ||
    (await derive(d.currentPassword, o.salt, o.iterations)) !== o.password_hash
  )
    throw new HttpError(403, "Senha atual inválida.");
  d.username = o.username;
  validPassword(d);
  const salt = randomToken();
  await e.DB.batch([
    e.DB.prepare(
      "UPDATE owner SET salt=?,password_hash=?,iterations=100000,epoch=epoch+1 WHERE id=1",
    ).bind(salt, await derive(d.password as string, salt)),
    e.DB.prepare("DELETE FROM sessions"),
  ]);
  return Response.json(
    { ok: true },
    { headers: { "Set-Cookie": cookie("", e.ENVIRONMENT === "local", true) } },
  );
}
