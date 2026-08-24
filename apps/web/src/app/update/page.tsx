'use client';

import './update.css';

export default function UpdatePage() {
  return (
    <div className="update-page">
      <div className="update-grid-overlay" />
      <div className="update-vignette" />

      <main>
        <header>
          <div className="update-main-logo-container">
            <img src="/icon-512.png" alt="Logo Eyano" className="update-main-logo" />
          </div>
          <h1>En cours de <span className="highlight">mise à jour</span></h1>
          <p className="update-sub-text">Merci pour vos contributions 🔥❤️</p>
          <p className="update-author-text">David ❤️🥂</p>
        </header>

        <section className="update-robot-container">
          <div className="update-platform" />
          <div className="update-platform-ring" />
          <div className="update-robot">
            <div className="update-cable update-cable-1" />
            <div className="update-cable update-cable-2" />
            <div className="update-cable update-cable-3" />
            <div className="update-cable update-cable-4" />
            <div className="update-connector update-conn-l1" />
            <div className="update-connector update-conn-l2" />
            <div className="update-connector update-conn-r1" />
            <div className="update-connector update-conn-r2" />
            <div className="update-robot-head">
              <div className="update-robot-face">
                <div className="update-eye" />
                <div className="update-eye" />
              </div>
            </div>
            <div className="update-robot-torso">
              <img src="/icon-512.png" alt="Logo Eyano" className="update-torso-logo" />
            </div>
            <div className="update-robot-base">
              <div className="update-base-light" />
            </div>
          </div>
        </section>

        <p className="update-message">Mise à jour en cours.<br/>Nous revenons avec une version plus efficace.</p>
      </main>
    </div>
  );
}
