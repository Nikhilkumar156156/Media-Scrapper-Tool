import re
import urllib.parse
from flask import Flask, request, jsonify, send_from_directory, Response
from ddgs import DDGS
import yt_dlp
import requests

app = Flask(__name__, static_folder='static', static_url_path='')

def resolve_video_download_url(video_url):
    """
    Use yt-dlp to extract the direct stream URL for a given video page URL.
    """
    ydl_opts = {
        'format': 'best',  # Best quality that has both audio and video
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(video_url, download=False)
            direct_url = info.get('url')
            
            # If standard url is missing, search formats for a combined audio/video stream
            if not direct_url:
                formats = info.get('formats', [])
                # Prioritize formats with both audio and video
                for fmt in reversed(formats):
                    if fmt.get('acodec') != 'none' and fmt.get('vcodec') != 'none':
                        direct_url = fmt.get('url')
                        break
                # Fallback to the last available format
                if not direct_url and formats:
                    direct_url = formats[-1].get('url')
                    
            title = info.get('title', 'video')
            return direct_url, title
        except Exception as e:
            print(f"Error resolving video download URL with yt-dlp: {e}")
            return None, None

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/api/search/images')
def search_images():
    query = request.args.get('q', '')
    limit = request.args.get('limit', 15, type=int)
    
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
        
    try:
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=limit))
        
        # Format results for the frontend
        formatted_results = []
        for r in results:
            formatted_results.append({
                'title': r.get('title', ''),
                'image': r.get('image', ''),
                'thumbnail': r.get('thumbnail', ''),
                'page_url': r.get('url', ''),
                'width': r.get('width', ''),
                'height': r.get('height', '')
            })
        return jsonify(formatted_results)
    except Exception as e:
        print(f"Image search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/gifs')
def search_gifs():
    query = request.args.get('q', '')
    limit = request.args.get('limit', 15, type=int)
    
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
        
    try:
        search_query = query
        if "gif" not in query.lower():
            search_query = f"{query} gif"
            
        # Fetch more than limit to filter actual GIF extensions
        fetch_limit = max(limit * 3, 50)
        
        with DDGS() as ddgs:
            results = list(ddgs.images(search_query, max_results=fetch_limit))
            
        formatted_results = []
        for r in results:
            img_url = r.get('image', '')
            # Check if URL contains .gif
            url_path = img_url.split('?')[0].lower()
            if url_path.endswith('.gif') or '.gif' in url_path:
                formatted_results.append({
                    'title': r.get('title', ''),
                    'image': img_url,
                    'thumbnail': r.get('thumbnail', ''),
                    'page_url': r.get('url', ''),
                    'width': r.get('width', ''),
                    'height': r.get('height', '')
                })
                if len(formatted_results) >= limit:
                    break
                    
        # Fallback: if we didn't find any GIFs by extension, return the raw results
        if not formatted_results and results:
            for r in results[:limit]:
                formatted_results.append({
                    'title': r.get('title', ''),
                    'image': r.get('image', ''),
                    'thumbnail': r.get('thumbnail', ''),
                    'page_url': r.get('url', ''),
                    'width': r.get('width', ''),
                    'height': r.get('height', '')
                })
        return jsonify(formatted_results)
    except Exception as e:
        print(f"GIF search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search/videos')
def search_videos():
    query = request.args.get('q', '')
    limit = request.args.get('limit', 15, type=int)
    
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
        
    try:
        with DDGS() as ddgs:
            results = list(ddgs.videos(query, max_results=limit))
            
        formatted_results = []
        for r in results:
            # Parse images if it's represented as a string or dict
            images_data = r.get('images', {})
            thumbnail_url = ''
            if isinstance(images_data, dict):
                thumbnail_url = images_data.get('medium') or images_data.get('large') or images_data.get('small')
            elif isinstance(images_data, str):
                # Simple parsing for string dicts
                try:
                    # Safe eval since it's from DDG Bing provider
                    img_dict = eval(images_data)
                    thumbnail_url = img_dict.get('medium') or img_dict.get('large') or img_dict.get('small')
                except Exception:
                    pass
            
            # Fallback if thumbnail could not be extracted
            if not thumbnail_url:
                thumbnail_url = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500' # default video thumbnail
                
            formatted_results.append({
                'title': r.get('title', ''),
                'video_url': r.get('content', ''),
                'description': r.get('description', ''),
                'duration': r.get('duration', ''),
                'thumbnail': thumbnail_url,
                'embed_url': r.get('embed_url', ''),
                'publisher': r.get('publisher', 'Video Source'),
                'uploader': r.get('uploader', '')
            })
        return jsonify(formatted_results)
    except Exception as e:
        print(f"Video search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download')
def download():
    url = request.args.get('url', '')
    media_type = request.args.get('type', 'image')
    filename = request.args.get('filename', 'media')
    
    if not url:
        return "URL parameter is required", 400
        
    original_url = url
    
    # Normalize media type to singular (handling plural values sent by the frontend)
    media_type = media_type.lower().strip()
    if media_type.endswith('s'):
        media_type = media_type[:-1]
        
    # Resolve video links on the fly using yt-dlp
    if media_type == 'video':
        direct_url, title = resolve_video_download_url(url)
        if direct_url:
            url = direct_url
            if title:
                # Sanitize filename
                filename = re.sub(r'[^a-zA-Z0-9 \-_]', '', title).strip()
                filename = filename or 'video'
        else:
            return "Failed to resolve direct video streaming URL from provider", 500
            
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
        
        # Fetch the stream
        req = requests.get(url, headers=headers, stream=True, timeout=60)
        req.raise_for_status()
        
        content_type = req.headers.get('content-type', '')
        ext = ''
        
        # Detect correct extension
        if 'image/jpeg' in content_type or 'image/jpg' in content_type:
            ext = '.jpg'
        elif 'image/png' in content_type:
            ext = '.png'
        elif 'image/gif' in content_type:
            ext = '.gif'
        elif 'image/webp' in content_type:
            ext = '.webp'
        elif 'video/mp4' in content_type:
            ext = '.mp4'
        elif 'video/webm' in content_type:
            ext = '.webm'
        elif 'video/ogg' in content_type or 'video/ogv' in content_type:
            ext = '.ogv'
            
        # Standardize name extension
        if ext:
            if not filename.endswith(ext):
                filename = filename.rsplit('.', 1)[0] + ext
        else:
            # Fallbacks
            if media_type == 'image' and not any(filename.endswith(e) for e in ['.jpg', '.jpeg', '.png', '.webp']):
                filename += '.jpg'
            elif media_type == 'gif' and not filename.endswith('.gif'):
                filename += '.gif'
            elif media_type == 'video' and not any(filename.endswith(e) for e in ['.mp4', '.webm', '.mkv']):
                filename += '.mp4'
                
        # Send streaming response
        response_headers = {
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': content_type or 'application/octet-stream'
        }
        
        if 'content-length' in req.headers:
            response_headers['Content-Length'] = req.headers['content-length']
            
        def generate():
            for chunk in req.iter_content(chunk_size=16384):
                if chunk:
                    yield chunk
                    
        return Response(generate(), headers=response_headers)
    except Exception as e:
        print(f"Download failed for {url}: {e}")
        return f"Download failed: {str(e)}", 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
