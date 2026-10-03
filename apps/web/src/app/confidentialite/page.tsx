import type { Metadata } from 'next';
import { legal } from '@/lib/legal';
import { LegalList, LegalPage, LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: "Comment Eyano, projet de recherche expérimental, traite vos données personnelles.",
};

export default function ConfidentialitePage() {
  return (
    <LegalPage title="Politique de confidentialité" current="/confidentialite">
      <LegalSection title="1. Responsable">
        <p>
          Les données sont traitées dans le cadre du projet de recherche {legal.product}, porté par {legal.organization} et
          mené par {legal.author}, {legal.authorRole}. Pour toute question ou demande, écrivez à{' '}
          <a href={`mailto:${legal.contactEmail}`} className="text-foreground underline underline-offset-4">{legal.contactEmail}</a>.
        </p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <LegalList
          items={[
            <><strong className="font-medium text-foreground">Compte</strong> : nom, adresse e-mail, mot de passe (enregistré uniquement sous forme chiffrée), photo de profil si vous vous connectez avec un compte tiers.</>,
            <><strong className="font-medium text-foreground">Conversations</strong> : vos messages, les réponses d&apos;{legal.product}, leurs titres et leurs dates.</>,
            <><strong className="font-medium text-foreground">Fichiers et images</strong> : les photos et documents que vous envoyez, et les images créées par Kepler.</>,
            <><strong className="font-medium text-foreground">Messagerie</strong> : si vous écrivez à {legal.product} par messagerie, votre numéro, votre nom d&apos;affichage et l&apos;historique récent de l&apos;échange.</>,
            <><strong className="font-medium text-foreground">Données techniques</strong> : statistiques d&apos;usage (nombre de requêtes, durée des réponses), adresse IP lors des actions d&apos;administration.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Pourquoi">
        <LegalList
          items={[
            'faire fonctionner le service : répondre à vos messages, conserver vos conversations, créer des images ;',
            'sécuriser le service : authentification, prévention des abus, journal des actions sensibles ;',
            'faire avancer le projet de recherche : mesurer la qualité des réponses, corriger les erreurs, améliorer le prototype.',
          ]}
        />
        <p>Vos données ne sont ni vendues, ni louées, ni utilisées à des fins publicitaires.</p>
      </LegalSection>

      <LegalSection title="4. Consultation des conversations par l'équipe">
        <p>
          Pour superviser ce prototype de recherche, le responsable du projet peut consulter les conversations des
          utilisateurs, en lecture seule. Cet accès est réservé au plus haut niveau d&apos;administration, et chaque
          consultation est inscrite dans un journal (qui, quoi, quand). N&apos;indiquez pas d&apos;informations sensibles
          (santé, données bancaires, mots de passe) dans vos conversations.
        </p>
      </LegalSection>

      <LegalSection title="5. Prestataires techniques">
        <p>
          Pour produire les réponses et les images, le contenu de vos messages est transmis à des prestataires techniques
          spécialisés en intelligence artificielle, qui le traitent pour le compte du projet. L&apos;hébergement de
          l&apos;application et de la base de données repose également sur des prestataires techniques. Pour les questions
          d&apos;actualité, une recherche peut être effectuée sur des sources publiques en ligne à partir de mots-clés tirés
          de votre question.
        </p>
      </LegalSection>

      <LegalSection title="6. Conservation">
        <p>
          Les données sont conservées tant que votre compte existe, ou jusqu&apos;à ce que vous en demandiez la suppression.
          S&apos;agissant d&apos;un prototype, elles peuvent aussi être effacées lors d&apos;une réinitialisation du service ou à
          la fin du projet de recherche.
        </p>
      </LegalSection>

      <LegalSection title="7. Vos droits">
        <p>Vous pouvez à tout moment :</p>
        <LegalList
          items={[
            'accéder à vos données et en obtenir une copie ;',
            'les faire rectifier ;',
            'supprimer une conversation depuis l’application ;',
            'demander la suppression de votre compte et de l’ensemble de vos données ;',
            'vous opposer à l’utilisation de vos conversations pour la recherche.',
          ]}
        />
        <p>
          Écrivez à <a href={`mailto:${legal.contactEmail}`} className="text-foreground underline underline-offset-4">{legal.contactEmail}</a>.
          Si vous résidez dans l&apos;Union européenne, vous pouvez aussi saisir l&apos;autorité de protection des données de votre pays.
        </p>
      </LegalSection>

      <LegalSection title="8. Stockage dans votre navigateur">
        <p>
          {legal.product} n&apos;utilise pas de cookies publicitaires. Votre navigateur conserve seulement le jeton de
          connexion (pour rester connecté) et vos préférences d&apos;affichage (thème).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
