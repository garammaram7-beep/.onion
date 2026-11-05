import requests
import sys
from bs4 import BeautifulSoup
import warnings

# Disable SSL warnings (Tor uses self-signed certs)
warnings.filterwarnings("ignore", category=UserWarning, module='requests')

def fetch_onion_page(onion_url):
   proxies = {
       'http': 'socks5h://127.0.0.1:9050',
       'https': 'socks5h://127.0.0.1:9050'
   }

   headers = {
       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0',
       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
       'Accept-Language': 'en-US,en;q=0.5',
       'Accept-Encoding': 'gzip, deflate',
       'Connection': 'close',
       'Upgrade-Insecure-Requests': '1'
   }

   try:
       print(f"[+] Fetching: {onion_url}")
       response = requests.get(
           onion_url,
           proxies=proxies,
           headers=headers,
           timeout=60,
           verify=False,
           allow_redirects=True
       )

       if response.status_code == 200:
           print(f"[+] Success | Status: {response.status_code} | Size: {len(response.content)} bytes")
           soup = BeautifulSoup(response.text, 'html.parser')
           print("\n" + "="*60)
           title = soup.find('title')
           if title:
               print(f"📌 TITLE: {title.get_text(strip=True)}\n")
           print(soup.prettify())
           print("="*60)
       else:
           print(f"[-] Failed | HTTP {response.status_code}")

   except requests.exceptions.ProxyError:
       print("[-] Proxy error — is Tor running? Run: sudo service tor start")
   except requests.exceptions.Timeout:
       print("[-] Timeout — onion site is slow or dead")
   except requests.exceptions.ConnectionError:
       print("[-] Connection refused — check Tor or URL")
   except Exception as e:
       print(f"[-] Unknown error: {str(e)}")

if __name__ == "__main__":
   if len(sys.argv) != 2:
       print("Usage: python3 onion_viewer.py <onion_url>")
       print("Example: python3 onion_viewer.py http://dready77z7f5x6v.onion")
       sys.exit(1)

   url = sys.argv[1]
   if not url.startswith("http://") or ".onion" not in url:
       print("[-] Invalid URL — must be http://*.onion")
       sys.exit(1)

   fetch_onion_page(url)
