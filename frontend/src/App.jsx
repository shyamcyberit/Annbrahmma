import React, { useState } from 'react';
import UserView from './components/UserView';
import AdminView from './components/AdminView';
import './index.css'; // Import the CSS file for styling

// Import your logo images
import annBrahammaLogo from './assets/logo5.png'; // Make sure the path is correct
import iitrLogo from './assets/Image1.png'; // Make sure the path is correct

function App() {
    const [view, setView] = useState('user'); // 'user' or 'admin'
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

    const handleAdminLogin = (status) => {
        setIsAdminLoggedIn(status);
        if (status) {
            setView('admin');
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo-section">
                    {/* IITR logo on the left */}
                    <img src={iitrLogo} alt="IITR Logo" className="iitr-logo" />
                    {/* AnnBrahamma logo on the right */}
                    <img src={annBrahammaLogo} alt="AnnBrahamma Logo" className="annbrahamma-logo" />
                </div>
                <h1>Welcome to AnnBrahamma Canteen Management Portal</h1>
                <div className="view-switcher">
                    <button
                        className={view === 'user' ? 'active' : ''}
                        onClick={() => { setView('user'); setIsAdminLoggedIn(false); }}
                    >
                        User View
                    </button>
                    <button
                        className={view === 'admin' ? 'active' : ''}
                        onClick={() => setView('admin')}
                    >
                        Admin View
                    </button>
                </div>
            </header>

            <main className="main-content">
                {view === 'user' ? (
                    <div className="container user-view-container">
                        <UserView />
                    </div>
                ) : (
                    <div className="container admin-view-container">
                        <AdminView isAdminLoggedIn={isAdminLoggedIn} onAdminLogin={handleAdminLogin} />
                    </div>
                )}
            </main>

            <footer className="app-footer">
                <p>&copy; {new Date().getFullYear()} AnnBrahamma Canteen Management Portal. All rights reserved.</p>
            </footer>
        </div>
    );
}

export default App;