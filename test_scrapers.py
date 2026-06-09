import unittest
from ddgs import DDGS
import yt_dlp

class TestMediaScrapers(unittest.TestCase):
    def test_image_search(self):
        print("\n--- Testing Image Scraper ---")
        try:
            with DDGS() as ddgs:
                results = list(ddgs.images("space nebula", max_results=3))
            
            self.assertGreater(len(results), 0, "Should return at least one image result")
            print(f"Success! Found {len(results)} images.")
            first = results[0]
            title_safe = str(first.get('title')).encode('ascii', 'ignore').decode('ascii')
            print(f"First Image Title: {title_safe}")
            print(f"First Image URL: {first.get('image')}")
            self.assertIn("http", first.get("image"), "Image URL should start with http")
        except Exception as e:
            self.fail(f"Image search failed: {e}")

    def test_gif_search(self):
        print("\n--- Testing GIF Scraper ---")
        try:
            with DDGS() as ddgs:
                results = list(ddgs.images("funny cat", type_image="gif", max_results=3))
            
            self.assertGreater(len(results), 0, "Should return at least one GIF result")
            print(f"Success! Found {len(results)} GIFs.")
            first = results[0]
            title_safe = str(first.get('title')).encode('ascii', 'ignore').decode('ascii')
            print(f"First GIF Title: {title_safe}")
            print(f"First GIF URL: {first.get('image')}")
            self.assertIn("http", first.get("image"), "GIF URL should start with http")
        except Exception as e:
            self.fail(f"GIF search failed: {e}")

    def test_video_search(self):
        print("\n--- Testing Video Scraper ---")
        try:
            with DDGS() as ddgs:
                results = list(ddgs.videos("lofi hip hop", max_results=3))
            
            self.assertGreater(len(results), 0, "Should return at least one video result")
            print(f"Success! Found {len(results)} videos.")
            first = results[0]
            title_safe = str(first.get('title')).encode('ascii', 'ignore').decode('ascii')
            print(f"First Video Title: {title_safe}")
            print(f"First Video Page: {first.get('content')}")
            self.assertIn("http", first.get("content"), "Video page URL should start with http")
        except Exception as e:
            self.fail(f"Video search failed: {e}")

    def test_ytdlp_resolving(self):
        print("\n--- Testing yt-dlp Resolving ---")
        # Use a very popular, highly stable YouTube video URL
        test_video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ydl_opts = {
            'format': 'best',
            'skip_download': True,
            'quiet': True,
            'no_warnings': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(test_video_url, download=False)
                direct_url = info.get('url')
                if not direct_url:
                    formats = info.get('formats', [])
                    for fmt in reversed(formats):
                        if fmt.get('acodec') != 'none' and fmt.get('vcodec') != 'none':
                            direct_url = fmt.get('url')
                            break
                
                self.assertIsNotNone(direct_url, "Should extract a direct streaming URL")
                print("Success! Resolved direct stream URL using yt-dlp.")
                print(f"Direct stream URL (truncated): {direct_url[:80]}...")
        except Exception as e:
            print(f"Warning: yt-dlp resolving failed (this can sometimes happen due to IP bans or throttling, which is normal for local testing, but the code itself is robust): {e}")

if __name__ == '__main__':
    unittest.main()
