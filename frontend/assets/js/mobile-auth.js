/**
 * Mobile Authentication Handler
 * Handles login, profile display, and dashboard navigation for mobile devices
 */

(function() {
    'use strict';

    // DOM Elements
    const elements = {
        mobileLoginBtn: document.getElementById('mobileLoginBtn'),
        mobileProfileWrapper: document.getElementById('mobileProfileWrapper'),
        mobileProfileBtn: document.getElementById('mobileProfileBtn'),
        profileHoverCard: document.getElementById('profileHoverCard'),
        profileHoverName: document.getElementById('profileHoverName'),
        profileHoverWallet: document.getElementById('profileHoverWallet'),
        loginBtn: document.getElementById('loginBtn'),
        registerBtn: document.getElementById('registerBtn'),
        userMenu: document.getElementById('userMenu'),
        userName: document.getElementById('userName')
    };

    // State
    let isLoggedIn = false;
    let currentUser = null;

    /**
     * Initialize mobile authentication
     */
    function init() {
        // Check if user is already logged in
        checkLoginStatus();
        
        // Add event listeners
        if (elements.mobileLoginBtn) {
            elements.mobileLoginBtn.addEventListener('click', handleMobileLogin);
        }

        if (elements.mobileProfileBtn) {
            elements.mobileProfileBtn.addEventListener('click', handleProfileClick);
        }

        // Listen for login/logout events
        window.addEventListener('userLoggedIn', handleUserLogin);
        window.addEventListener('userLoggedOut', handleUserLogout);
        
        // Sync with desktop auth
        syncDesktopAuth();
    }

    /**
     * Check if user is logged in
     */
    function checkLoginStatus() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('userData');
        
        if (token && user) {
            try {
                currentUser = JSON.parse(user);
                updateUIForLoggedInUser();
            } catch (e) {
                console.error('Error parsing user data:', e);
                handleUserLogout();
            }
        }
    }

    /**
     * Handle mobile login button click
     */
    function handleMobileLogin() {
        // Open login modal
        if (window.AnimationHelpers && window.AnimationHelpers.openModal) {
            window.AnimationHelpers.openModal('loginModal');
        } else {
            // Fallback
            const loginModal = document.getElementById('loginModal');
            if (loginModal) {
                loginModal.style.display = 'flex';
            }
        }
    }

    /**
     * Handle profile button click - navigate to dashboard
     */
    function handleProfileClick() {
        window.location.href = 'dashboard.html';
    }

    /**
     * Handle user login event
     */
    function handleUserLogin(event) {
        currentUser = event.detail || JSON.parse(localStorage.getItem('userData'));
        updateUIForLoggedInUser();
    }

    /**
     * Handle user logout event
     */
    function handleUserLogout() {
        currentUser = null;
        isLoggedIn = false;
        
        // Show login button, hide profile
        if (elements.mobileLoginBtn) {
            elements.mobileLoginBtn.style.display = 'flex';
        }
        if (elements.mobileProfileWrapper) {
            elements.mobileProfileWrapper.style.display = 'none';
        }
        
        // Clear storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
    }

    /**
     * Update UI for logged in user
     */
    function updateUIForLoggedInUser() {
        isLoggedIn = true;

        // Hide login button, show profile
        if (elements.mobileLoginBtn) {
            elements.mobileLoginBtn.style.display = 'none';
        }
        if (elements.mobileProfileWrapper) {
            elements.mobileProfileWrapper.style.display = 'flex';
        }

        // Update profile hover card
        if (currentUser) {
            const displayName = currentUser.username || currentUser.email || 'User';
            const walletAddress = currentUser.wallet_address || 'Not connected';
            
            if (elements.profileHoverName) {
                elements.profileHoverName.textContent = displayName;
            }
            if (elements.profileHoverWallet) {
                elements.profileHoverWallet.textContent = formatWalletAddress(walletAddress);
            }
            
            // Also update desktop UI if elements exist
            if (elements.userName) {
                elements.userName.textContent = displayName;
            }
        }
    }

    /**
     * Format wallet address for display
     */
    function formatWalletAddress(address) {
        if (!address || address === 'Not connected') {
            return 'Not connected';
        }
        
        if (address.length > 20) {
            return `${address.slice(0, 10)}...${address.slice(-8)}`;
        }
        
        return address;
    }

    /**
     * Sync with desktop authentication state
     */
    function syncDesktopAuth() {
        // Monitor desktop login/logout buttons
        const desktopLogoutBtn = document.getElementById('logoutBtn');
        
        if (desktopLogoutBtn) {
            desktopLogoutBtn.addEventListener('click', () => {
                handleUserLogout();
            });
        }

        // Observe changes to desktop user menu visibility
        if (elements.userMenu) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'style') {
                        const isVisible = window.getComputedStyle(elements.userMenu).display !== 'none';
                        if (isVisible && !isLoggedIn) {
                            checkLoginStatus();
                        } else if (!isVisible && isLoggedIn) {
                            handleUserLogout();
                        }
                    }
                });
            });

            observer.observe(elements.userMenu, {
                attributes: true,
                attributeFilter: ['style']
            });
        }
    }

    /**
     * Add smooth animations
     */
    function addAnimations() {
        // Add glow pulse to profile button
        if (elements.mobileProfileBtn) {
            elements.mobileProfileBtn.style.animation = 'glow-pulse 2s ease-in-out infinite';
        }

        // Add slide-in animation to hover card
        if (elements.profileHoverCard) {
            elements.profileHoverCard.style.animation = 'slide-in-bounce 0.3s ease-out';
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Export to window for external access
    window.MobileAuth = {
        updateUser: handleUserLogin,
        logout: handleUserLogout,
        checkStatus: checkLoginStatus
    };

})();
