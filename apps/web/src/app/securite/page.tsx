import type { Metadata } from 'next';
import { legal } from '@/lib/legal';
import { LegalList, LegalPage, LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Sécurité',
  description: "Mesures de sécurité d'Eyano et signalement des vulnérabilités.",
};

export default function SecuritePage() {
  return (
    <LegalPage title="Sécurité" current="/securite">
      <LegalSection title="1. Mesures en place">
        <LegalList
          items={[
            <><strong className="font-medium text-foreground">Mots de passe</strong> : jamais stockés en clair, uniquement sous forme d&apos;empreinte chiffrée (bcrypt).</>,
            <><strong className="font-medium text-foreground">Sessions</strong> : jetons de connexion signés, à durée de validité limitée.</>,
            <><strong className="font-medium text-foreground">Cloisonnement</strong> : chaque utilisateur n&apos;accède qu&apos;à ses propres conversations, fichiers et images ; ce contrôle est vérifié par des tests automatisés.</>,
            <><strong className="font-medium text-foreground">Rôles</strong> : les fonctions d&apos;administration sont réservées à des comptes habilités ; la lecture des conversations est réservée au plus haut niveau d&apos;administration.</>,
            <><strong className="font-medium text-foreground">Traçabilité</strong> : les actions sensibles (changement de rôle, suspension de compte, consultation d&apos;une conversation) sont inscrites dans un journal d&apos;audit.</>,
            <><strong className="font-medium text-foreground">Limitation</strong> : le nombre de requêtes adressées à l&apos;IA est limité, pour prévenir les abus.</>,
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Limites d'un prototype">
        <p>
          {legal.product} est un projet de recherche expérimental. Malgré ces mesures, il n&apos;a pas fait l&apos;objet
          d&apos;un audit de sécurité indépendant et ne doit pas servir à traiter des informations sensibles. Utilisez un mot
          de passe qui vous est propre et ne partagez pas de données confidentielles dans vos conversations.
        </p>
      </LegalSection>

      <LegalSection title="3. Vos bonnes pratiques">
        <LegalList
          items={[
            'choisissez un mot de passe long et unique ;',
            'déconnectez-vous sur un appareil partagé ;',
            'méfiez-vous de tout message qui vous demanderait votre mot de passe : l’équipe ne vous le demandera jamais.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Signaler une vulnérabilité">
        <p>
          Si vous découvrez une faille, écrivez à{' '}
          <a href={`mailto:${legal.contactEmail}`} className="text-foreground underline underline-offset-4">{legal.contactEmail}</a>{' '}
          en décrivant le problème et la façon de le reproduire. Merci de ne pas l&apos;exploiter, de ne pas accéder aux données
          d&apos;autres utilisateurs et de nous laisser le temps de la corriger avant toute publication.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
