"""Fetch several pages at once and count the words on each."""
import asyncio
import re

import aiohttp

URLS = [
    "https://example.com",
    "https://example.org",
]
WORD = re.compile(r"[A-Za-z]+")


async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()


async def count_words(session, url):
    html = await fetch(session, url)
    words = WORD.findall(html)
    return url, len(words)


async def main():
    async with aiohttp.ClientSession() as session:
        tasks = [count_words(session, url) for url in URLS]
        for url, count in await asyncio.gather(*tasks):
            print(f"{url}: {count} words")


asyncio.run(main())
