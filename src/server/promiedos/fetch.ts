export const PROMIEDOS = 'https://www.promiedos.com.ar';
export const TEAM_PATH = '/team/boca-juniors/igg';
export const gamePath = (slug: string, id: string) => `/game/${slug}/${id}`;
export const leaguePath = (urlName: string, id: string) => `/league/${urlName}/${id}`;

const API = 'https://api.promiedos.com.ar';
const HEADERS = { 'User-Agent': 'BocaDashBot/1.0 (proyecto de un hincha)' };
const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>(.*?)<\/script>/s;

async function get(url: string, extra: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers: { ...HEADERS, ...extra }, signal: AbortSignal.timeout(8000) });
  if (res.status !== 200) throw new Error(`promiedos ${url} → HTTP ${res.status}`);
  return res;
}

/** The page's `props.pageProps` from its `__NEXT_DATA__` script. */
export async function fetchNextData(path: string): Promise<any> {
  const html = await (await get(PROMIEDOS + path)).text();
  const m = NEXT_DATA.exec(html);
  if (!m) throw new Error(`promiedos ${path}: no __NEXT_DATA__`);
  return JSON.parse(m[1]).props.pageProps;
}

/** Raw JSON API. Only the seed uses it. */
export async function fetchApi(path: string): Promise<any> {
  return (await get(API + path, { 'X-VER': '1.11.7.3' })).json();
}
