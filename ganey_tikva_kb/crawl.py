"""Crawl ganeytikva.org.il (same domain only) and save each HTML page + its main content as JSON.
Usage: python3 -I crawl.py OUT_DIR [max_pages]"""
import sys, json, re, hashlib, time, collections, urllib.parse as up
import requests
from bs4 import BeautifulSoup

START = "https://www.ganeytikva.org.il/"
DOMAIN = "ganeytikva.org.il"
DOC_EXT = re.compile(r"\.(pdf|docx?|xlsx?|pptx?|zip)(\?|$)", re.I)
SKIP_EXT = re.compile(r"\.(jpe?g|png|gif|svg|webp|css|js|ico|mp4|mp3)(\?|$)", re.I)

out = sys.argv[1]; limit = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
import os; os.makedirs(out, exist_ok=True)
s = requests.Session(); s.headers["User-Agent"] = "Mozilla/5.0 (knowledge-base indexer)"

def norm(u):
    u, _ = up.urldefrag(u)
    p = up.urlparse(u)
    return p._replace(netloc=p.netloc.lower()).geturl()

def main_content(soup):
    for t in soup(["script", "style", "noscript", "header", "footer", "nav", "form"]):
        t.decompose()
    for sel in ["main", "article", "#content", ".content", "#main", ".page-content"]:
        el = soup.select_one(sel)
        if el and len(el.get_text(strip=True)) > 100:
            return el
    return soup.body or soup

seen, q, n = set(), collections.deque([START]), 0
while q and n < limit:
    url = q.popleft()
    if url in seen: continue
    seen.add(url)
    try:
        r = s.get(url, timeout=30)
    except Exception as e:
        print("ERR", url, e); continue
    if "text/html" not in r.headers.get("content-type", ""): continue
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "lxml")
    title = (soup.find("h1") or soup.title or soup).get_text(" ", strip=True)[:200]
    links = []
    for a in soup.find_all("a", href=True):
        u = norm(up.urljoin(url, a["href"]))
        if DOMAIN not in up.urlparse(u).netloc or u.startswith(("mailto:", "tel:")): continue
        if DOC_EXT.search(u) or SKIP_EXT.search(u): continue
        if u not in seen: q.append(u)
    body = main_content(soup)
    imgs = [up.urljoin(url, i["src"]) for i in body.find_all("img", src=True)]
    docs = [{"text": a.get_text(" ", strip=True), "url": up.urljoin(url, a["href"])}
            for a in body.find_all("a", href=True) if DOC_EXT.search(a["href"])]
    rec = {"url": url, "title": title,
           "breadcrumbs": [b.get_text(" ", strip=True) for b in soup.select(".breadcrumb a, .breadcrumbs a")],
           "html": str(body), "text": body.get_text("\n", strip=True), "images": imgs, "attachments": docs}
    fn = hashlib.md5(url.encode()).hexdigest()[:12] + ".json"
    json.dump(rec, open(os.path.join(out, fn), "w", encoding="utf-8"), ensure_ascii=False)
    n += 1; print(n, url); time.sleep(0.5)
print("done", n, "pages")
