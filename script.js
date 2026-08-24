document.addEventListener('DOMContentLoaded', () => {
    console.log("Interface de mise à jour initialisée. Logo officiel chargé.");

    // ==========================================================================
    // CONFIGURATION DE LA PROGRESSION
    // ==========================================================================
    const targetPercent = 72; // Pourcentage cible pour la barre de progression
    const panelPercentElement = document.getElementById('panel-percent');
    const circle = document.querySelector('.progress-ring__circle');
    const stepsList = document.querySelectorAll('.steps-list li');
    
    // Configurer le SVG Circulaire
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference;

    // Fonction pour mettre à jour la progression du cercle
    function setProgress(percent) {
        const offset = circumference - (percent / 100 * circumference);
        circle.style.strokeDashoffset = offset;
    }

    // Fonction d'animation du pourcentage (pourcentage et cercle simultanés)
    function animateProgress(current, target) {
        if (current >= target) {
            panelPercentElement.innerText = target;
            setProgress(target);
            checkSteps(target);
            return;
        }

        current++;
        panelPercentElement.innerText = current;
        setProgress(current);
        checkSteps(current);

        // Délai aléatoire pour un effet plus naturel (premium)
        const delay = (target - current > 10) ? 50 : 150;
        setTimeout(() => animateProgress(current, target), delay);
    }

    // Activer les étapes de la liste en fonction du pourcentage
    function checkSteps(percent) {
        if (percent >= 10) stepsList[0].classList.add('active-step'); // Optimisation...
        if (percent >= 30) stepsList[1].classList.add('active-step'); // Sécurité...
        if (percent >= 50) stepsList[2].classList.add('active-step'); // Performances...
        if (percent >= 72) stepsList[3].classList.add('active-step'); // Nouvelles fonctionnalités...
    }

    // Démarrer l'animation après un court délai
    setTimeout(() => {
        animateProgress(0, targetPercent);
    }, 1000);

    // ==========================================================================
    // GÉNÉRATION DES PARTICULES FLOTTANTES
    // ==========================================================================
    const particlesContainer = document.getElementById('particles-container');
    const isMobile = window.innerWidth <= 768;
    const particleCount = isMobile ? 30 : 100;

    for (let i = 0; i < particleCount; i++) {
        createParticle();
    }

    function createParticle() {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Taille aléatoire
        const size = Math.random() * 3 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        
        // Position initiale aléatoire
        particle.style.top = `${Math.random() * 100}vh`;
        particle.style.left = `${Math.random() * 100}vw`;
        
        // Couleur néon avec opacité aléatoire
        particle.style.backgroundColor = `rgba(57, 255, 20, ${Math.random() * 0.5 + 0.1})`;
        
        // Animation de flottement aléatoire
        particle.style.animation = `floatParticle ${Math.random() * 10 + 5}s infinite linear`;
        particle.style.animationDelay = `${Math.random() * 5}s`;

        // Glow subtil
        particle.style.boxShadow = `0 0 5px rgba(57, 255, 20, ${Math.random() * 0.8})`;

        particlesContainer.appendChild(particle);
    }

    // ==========================================================================
    // EFFET DE PARALLAX (Desktop uniquement)
    // ==========================================================================
    if (!isMobile) {
        const leftPanel = document.querySelector('.left-panel');
        const rightPanel = document.querySelector('.right-panel');
        const robotInfrastructure = document.querySelector('.robot-infrastructure');

        document.addEventListener('mousemove', (e) => {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 40;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 40;

            // Déplacement sur l'axe X pour les panels
            leftPanel.style.transform = `translateX(${-xAxis}px)`;
            rightPanel.style.transform = `translateX(${xAxis}px)`;
            
            // Déplacement subtil X et Y pour le robot
            robotInfrastructure.style.transform = `translateX(${-xAxis / 2}px) translateY(${-yAxis / 2}px)`;
        });
    }

});