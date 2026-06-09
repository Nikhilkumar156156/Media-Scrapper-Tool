document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const limitInput = document.getElementById('limit-input');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const activeIndicator = document.querySelector('.active-indicator');
    const emptyState = document.getElementById('empty-state');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const mediaGrid = document.getElementById('media-grid');
    
    // Lightbox Elements
    const lightboxModal = document.getElementById('lightbox-modal');
    const modalClose = document.getElementById('modal-close');
    const mediaPreviewContainer = document.getElementById('media-preview-container');
    const modalTitle = document.getElementById('modal-title');
    const modalMetaDimensions = document.getElementById('modal-meta-dimensions');
    const modalMetaSource = document.getElementById('modal-meta-source');
    const modalMetaDuration = document.getElementById('modal-meta-duration');
    const modalDownloadBtn = document.getElementById('modal-download-btn');
    const modalSourceBtn = document.getElementById('modal-source-btn');
    
    const toastContainer = document.getElementById('toast-container');
    const tagPills = document.querySelectorAll('.tag-pill');

    // Application State
    let state = {
        activeTab: 'images',
        query: '',
        limit: 15,
        loading: false,
        cache: {
            images: null,
            gifs: null,
            videos: null
        }
    };

    // Initialize Active Tab Indicator position
    updateTabIndicator();

    // Event Listeners
    searchForm.addEventListener('submit', handleSearchSubmit);
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (targetTab === state.activeTab) return;
            
            // Update active button style
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            state.activeTab = targetTab;
            updateTabIndicator();
            
            // If we have a query, render or fetch
            if (state.query) {
                if (state.cache[state.activeTab]) {
                    renderMediaGrid(state.cache[state.activeTab], state.activeTab);
                } else {
                    fetchMediaData();
                }
            }
        });
    });

    // Handle tag pill clicks
    tagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            searchInput.value = pill.textContent;
            handleSearchSubmit();
        });
    });

    // Close Modal triggers
    modalClose.addEventListener('click', closeLightbox);
    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal) closeLightbox();
    });
    
    // Key bindings for Lightbox closing
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
            closeLightbox();
        }
    });

    // Functions
    function updateTabIndicator() {
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${state.activeTab}"]`);
        if (!activeBtn) return;
        
        const offsetLeft = activeBtn.offsetLeft;
        const width = activeBtn.offsetWidth;
        
        activeIndicator.style.transform = `translateX(${offsetLeft - 6}px)`;
        activeIndicator.style.width = `${width}px`;
    }

    // Handle window resize to re-align tab indicator
    window.addEventListener('resize', updateTabIndicator);

    function handleSearchSubmit(e) {
        if (e) e.preventDefault();
        
        const rawQuery = searchInput.value.trim();
        const limitVal = parseInt(limitInput.value) || 15;
        
        if (!rawQuery) {
            showToast('Please enter a search keyword', 'warning');
            return;
        }

        // Reset Cache on new search
        state.query = rawQuery;
        state.limit = limitVal;
        state.cache = {
            images: null,
            gifs: null,
            videos: null
        };
        
        fetchMediaData();
    }

    async function fetchMediaData() {
        if (state.loading) return;
        
        state.loading = true;
        emptyState.classList.add('hidden');
        mediaGrid.classList.add('hidden');
        
        // Show loaders
        renderSkeletons(state.limit, state.activeTab);
        skeletonLoader.classList.remove('hidden');
        
        const activeSearchTab = state.activeTab;
        const url = `/api/search/${activeSearchTab}?q=${encodeURIComponent(state.query)}&limit=${state.limit}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP error! Status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Store in cache
            state.cache[activeSearchTab] = data;
            
            // Only render if the active tab hasn't changed while fetching
            if (state.activeTab === activeSearchTab) {
                skeletonLoader.classList.add('hidden');
                renderMediaGrid(data, activeSearchTab);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast(`Scraping failed: ${error.message}`, 'error');
            
            if (state.activeTab === activeSearchTab) {
                skeletonLoader.classList.add('hidden');
                
                // Show empty state again if no previous cache results exist
                if (!state.cache[activeSearchTab]) {
                    emptyState.classList.remove('hidden');
                }
            }
        } finally {
            state.loading = false;
        }
    }

    function renderSkeletons(count, mode) {
        skeletonLoader.innerHTML = '';
        
        // Adjust display mode styles of skeleton container
        skeletonLoader.className = 'skeleton-grid';
        if (mode === 'images') skeletonLoader.classList.add('images-mode');
        else if (mode === 'gifs') skeletonLoader.classList.add('gifs-mode');
        else if (mode === 'videos') skeletonLoader.classList.add('videos-mode');
        
        const cols = (mode === 'videos') ? 'skeleton-card-video' : '';
        
        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.className = `skeleton-card ${cols}`;
            
            if (mode === 'videos') {
                card.innerHTML = `
                    <div class="skeleton-shimmer shimmer-img"></div>
                    <div class="shimmer-info">
                        <div class="skeleton-shimmer shimmer-line title"></div>
                        <div class="skeleton-shimmer shimmer-line desc1"></div>
                        <div class="skeleton-shimmer shimmer-line desc2"></div>
                    </div>
                `;
            } else {
                card.innerHTML = `<div class="skeleton-shimmer"></div>`;
            }
            skeletonLoader.appendChild(card);
        }
    }

    function renderMediaGrid(data, type) {
        mediaGrid.innerHTML = '';
        
        // Adjust grid type class names
        mediaGrid.className = 'media-grid';
        if (type === 'images') mediaGrid.classList.add('images-mode');
        else if (type === 'gifs') mediaGrid.classList.add('gifs-mode');
        else if (type === 'videos') mediaGrid.classList.add('videos-mode');
        
        if (!data || data.length === 0) {
            mediaGrid.classList.add('hidden');
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h3').textContent = 'No results found';
            emptyState.querySelector('p').textContent = `We couldn't scrape any ${type} for "${state.query}". Please try another search term.`;
            return;
        }
        
        data.forEach(item => {
            const card = createMediaCard(item, type);
            mediaGrid.appendChild(card);
        });
        
        mediaGrid.classList.remove('hidden');
    }

    function createMediaCard(item, type) {
        const card = document.createElement('div');
        card.className = 'media-card';
        
        if (type === 'images' || type === 'gifs') {
            card.innerHTML = `
                <div class="media-card-img-wrapper">
                    <img src="${item.thumbnail || item.image}" alt="${item.title}" loading="lazy">
                    <div class="card-overlay">
                        <h4 class="card-title">${item.title || 'Untitled Image'}</h4>
                        <div class="card-actions">
                            <span class="card-meta">
                                <i class="fa-solid fa-expand"></i> ${item.width && item.height ? `${item.width}x${item.height}` : 'Dimensions unknown'}
                            </span>
                            <button class="btn-card-action btn-dl-direct" data-url="${item.image}" data-title="${item.title || 'image'}">
                                <i class="fa-solid fa-download"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            // Clicking the card opens lightbox
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-dl-direct')) return; // ignore download button click
                openLightbox(item, type);
            });
            
            // Direct download button inside card
            const dlBtn = card.querySelector('.btn-dl-direct');
            dlBtn.addEventListener('click', () => {
                triggerMediaDownload(item.image, type, item.title || 'download');
            });
            
        } else if (type === 'videos') {
            card.innerHTML = `
                <div class="media-card-img-wrapper" style="height: 180px; flex: none;">
                    <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
                    <span class="video-duration"><i class="fa-solid fa-clock"></i> ${item.duration || '0:00'}</span>
                    <span class="publisher-badge"><i class="fa-solid fa-circle"></i> ${item.publisher}</span>
                    <div class="play-badge"><i class="fa-solid fa-play"></i></div>
                </div>
                <div class="media-card-info">
                    <h4>${item.title}</h4>
                    <p>${item.description || 'No description available.'}</p>
                    <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
                        <button class="btn-card-action btn-dl-video" data-url="${item.video_url}" data-title="${item.title}">
                            <i class="fa-solid fa-download"></i> Download Video
                        </button>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-dl-video')) return; // ignore download button click
                openLightbox(item, type);
            });
            
            const dlBtn = card.querySelector('.btn-dl-video');
            dlBtn.addEventListener('click', () => {
                triggerMediaDownload(item.video_url, type, item.title || 'video');
            });
        }
        
        return card;
    }

    // Lightbox modal operations
    function openLightbox(item, type) {
        mediaPreviewContainer.innerHTML = '';
        modalMetaDimensions.classList.add('hidden');
        modalMetaDuration.classList.add('hidden');
        modalMetaSource.innerHTML = '';
        
        modalTitle.textContent = item.title || 'Untitled Media';
        
        if (type === 'images' || type === 'gifs') {
            const img = document.createElement('img');
            img.src = item.image;
            img.alt = item.title;
            mediaPreviewContainer.appendChild(img);
            
            if (item.width && item.height) {
                modalMetaDimensions.innerHTML = `<i class="fa-solid fa-expand"></i> ${item.width} x ${item.height}`;
                modalMetaDimensions.classList.remove('hidden');
            }
            
            modalMetaSource.innerHTML = `<i class="fa-solid fa-link"></i> Photo Search`;
            
            // Download configuration
            modalDownloadBtn.onclick = (e) => {
                e.preventDefault();
                triggerMediaDownload(item.image, type, item.title || 'image');
            };
            
            modalSourceBtn.classList.remove('hidden');
            modalSourceBtn.href = item.page_url || '#';
            if (!item.page_url) modalSourceBtn.classList.add('hidden');
            
        } else if (type === 'videos') {
            // Embed iframe if available
            if (item.embed_url) {
                const iframe = document.createElement('iframe');
                iframe.src = item.embed_url;
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                iframe.allowFullscreen = true;
                mediaPreviewContainer.appendChild(iframe);
            } else {
                // Render fallback video component or thumbnail
                const img = document.createElement('img');
                img.src = item.thumbnail;
                img.alt = item.title;
                mediaPreviewContainer.appendChild(img);
            }
            
            if (item.duration) {
                modalMetaDuration.innerHTML = `<i class="fa-solid fa-clock"></i> ${item.duration}`;
                modalMetaDuration.classList.remove('hidden');
            }
            
            modalMetaSource.innerHTML = `<i class="fa-solid fa-network-wired"></i> ${item.publisher} (${item.uploader || 'Unknown'})`;
            
            modalDownloadBtn.onclick = (e) => {
                e.preventDefault();
                triggerMediaDownload(item.video_url, type, item.title || 'video');
            };
            
            modalSourceBtn.classList.remove('hidden');
            modalSourceBtn.href = item.video_url;
        }
        
        lightboxModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Lock background scroll
    }

    function closeLightbox() {
        lightboxModal.classList.add('hidden');
        mediaPreviewContainer.innerHTML = ''; // Clear source to stop videos/audios in background
        document.body.style.overflow = 'auto'; // Enable scrolling again
    }

    // Download handlers
    function triggerMediaDownload(url, type, filename) {
        showToast(`Preparing download for "${filename.substring(0, 30)}..."`, 'info');
        
        // Target Flask proxy download route
        const dlUrl = `/api/download?url=${encodeURIComponent(url)}&type=${type}&filename=${encodeURIComponent(filename)}`;
        
        // We use iframe/anchor tag to prompt the native browser save modal
        const a = document.createElement('a');
        a.href = dlUrl;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup after trigger
        setTimeout(() => {
            document.body.removeChild(a);
            showToast('Download started in browser!', 'success');
        }, 1500);
    }

    // Toast Alerts
    function showToast(message, type = 'info', duration = 3500) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        else if (type === 'error') iconClass = 'fa-circle-xmark';
        else if (type === 'warning') iconClass = 'fa-triangle-exclamation';
        
        toast.innerHTML = `
            <i class="fa-solid ${iconClass} toast-icon"></i>
            <div class="toast-body">${message}</div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Force reflow and show
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode === toastContainer) {
                    toastContainer.removeChild(toast);
                }
            }, 400); // match CSS transform transitions
        }, duration);
    }
});
