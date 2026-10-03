import type { Metadata } from 'next';
import Link from 'next/link';
import { legal } from '@/lib/legal';
import { LegalList, LegalPage, LegalSection } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions d'utilisation d'Eyano, projet de recherche expérimental en intelligence artificielle.",
};

export default function ConditionsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" current="/conditions">
      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions encadrent l&apos;utilisation d&apos;{legal.product}, un assistant conversationnel fondé sur
          l&apos;intelligence artificielle, accessible sur le web et par messagerie. En créant un compte ou en utilisant le
          service, vous acceptez ces conditions.
        </p>
      </LegalSection>

      <LegalSection title="2. Un projet de recherche expérimental">
        <p>
          {legal.product} est conçu par {legal.maker} pour {legal.organization}, dans le cadre d&apos;un projet de recherche
          en intelligence artificielle mené par {legal.author}, {legal.authorRole}. Il s&apos;agit d&apos;un prototype :
        </p>
        <LegalList
          items={[
            'il est en cours de développement et peut évoluer, être interrompu ou réinitialisé à tout moment, sans préavis ;',
            "il est proposé à des fins de démonstration, d'expérimentation et de recherche, sans vocation commerciale ;",
            "certaines fonctions sont expérimentales (par exemple Kepler, l'extension de création d'images) et peuvent être limitées ou indisponibles ;",
            "aucune disponibilité, aucune performance et aucune conservation des données ne sont garanties.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Compte">
        <p>
          Vous êtes responsable de la confidentialité de vos identifiants et de l&apos;activité réalisée depuis votre compte.
          Les informations fournies à l&apos;inscription doivent être exactes. Le service s&apos;adresse aux personnes âgées
          d&apos;au moins 15 ans ; les plus jeunes doivent l&apos;utiliser avec l&apos;accord d&apos;un parent ou tuteur.
        </p>
      </LegalSection>

      <LegalSection title="4. Utilisation acceptable">
        <p>Vous vous engagez à ne pas utiliser {legal.product} pour :</p>
        <LegalList
          items={[
            'produire ou diffuser des contenus illégaux, haineux, harcelants, violents, sexuels impliquant des mineurs, ou portant atteinte à autrui ;',
            "créer des images trompeuses d'une personne réelle, ou usurper l'identité de quelqu'un ;",
            'porter atteinte aux droits de tiers (droit à l’image, vie privée, propriété intellectuelle) ;',
            'tenter de contourner les protections du service, d’accéder aux données d’autres utilisateurs ou de perturber son fonctionnement ;',
            'automatiser massivement les requêtes ou revendre l’accès au service.',
          ]}
        />
        <p>
          En cas de manquement, l&apos;accès au compte peut être suspendu ou supprimé, sans préavis.
        </p>
      </LegalSection>

      <LegalSection title="5. Réponses générées par l'IA">
        <p>
          Les réponses et les images sont produites automatiquement. Elles peuvent être inexactes, incomplètes, datées ou
          inappropriées. Elles ne constituent ni un conseil médical, juridique, financier ou professionnel, ni une source
          d&apos;information vérifiée. Vérifiez toujours les informations importantes avant de vous en servir.
        </p>
        <p>
          Lorsqu&apos;une question porte sur l&apos;actualité, {legal.product} peut consulter des sources publiques en ligne
          pour compléter sa réponse ; il ne garantit pas leur exactitude.
        </p>
      </LegalSection>

      <LegalSection title="6. Contenus et images">
        <p>
          Vous restez responsable des contenus que vous envoyez (messages, photos, documents) et de l&apos;usage que vous
          faites des réponses et des images créées. Les images générées par Kepler sont fournies sans garantie quant à
          leurs droits d&apos;utilisation ; évitez de les présenter comme des photographies réelles.
        </p>
        <p>
          La marque {legal.product}, son interface et ses composants restent la propriété de leurs auteurs.
        </p>
      </LegalSection>

      <LegalSection title="7. Supervision du projet">
        <p>
          Pour suivre la qualité du prototype, corriger les erreurs et faire avancer la recherche, l&apos;équipe du projet
          peut consulter les conversations, en lecture seule. Chaque consultation est enregistrée. Les détails figurent
          dans la{' '}
          <Link href="/confidentialite" className="text-foreground underline underline-offset-4">politique de confidentialité</Link>.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité">
        <p>
          Le service est fourni « en l&apos;état ». Dans les limites permises par la loi, l&apos;équipe du projet ne peut être
          tenue responsable des conséquences de l&apos;utilisation des réponses, d&apos;une indisponibilité ou d&apos;une perte
          de données.
        </p>
      </LegalSection>

      <LegalSection title="9. Évolution des conditions">
        <p>
          Ces conditions peuvent être modifiées à mesure que le projet évolue. La date de mise à jour figure en haut de cette
          page. Continuer à utiliser le service après une modification vaut acceptation de la nouvelle version.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
