'use client';

import type { ReactNode } from 'react';
import { Copy, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Alert, Card, EmptyState, Progress, Separator, Skeleton, Spinner } from '@/components/ui/feedback';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/overlay';
import { useToast } from '@/lib/toast';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-heading-sm text-foreground">{title}</h2>
      {children}
    </section>
  );
}

const Row = ({ children }: { children: ReactNode }) => <div className="flex flex-wrap items-center gap-3">{children}</div>;

export function Showcase() {
  const { addToast } = useToast();

  return (
    <main className="h-dvh overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 sm:px-6">
        <header className="flex flex-col gap-2">
          <p className="text-caption text-foreground-muted">EYANO</p>
          <h1 className="text-heading-xl text-foreground">Design System</h1>
          <p className="text-body-md text-foreground-secondary">Primitives et etats. Voir DESIGN-SYSTEM.md.</p>
        </header>

        <Section title="Typographie">
          <div className="flex flex-col gap-2">
            <p className="text-display text-foreground">Display</p>
            <p className="text-heading-xl text-foreground">Heading XL</p>
            <p className="text-heading-lg text-foreground">Heading LG</p>
            <p className="text-heading-md text-foreground">Heading MD</p>
            <p className="text-heading-sm text-foreground">Heading SM</p>
            <p className="text-body-lg text-foreground">Body LG — lecture longue.</p>
            <p className="text-body-md text-foreground">Body MD — texte par defaut, messages.</p>
            <p className="text-body-md text-foreground-secondary">Body MD secondaire — texte d&apos;accompagnement.</p>
            <p className="text-body-sm text-foreground-muted">Body SM discret — metadonnees.</p>
            <p className="text-label text-foreground">Label</p>
            <p className="text-caption text-foreground-muted">Caption — 12:04</p>
            <code className="font-mono text-code text-foreground">npm run test -w apps/web</code>
          </div>
        </Section>

        <Section title="Boutons">
          <Row>
            <Button variant="primary" icon={Plus}>Nouvelle conversation</Button>
            <Button variant="secondary">Secondaire</Button>
            <Button variant="outline">Contour</Button>
            <Button variant="ghost">Discret</Button>
            <Button variant="destructive" icon={Trash2}>Supprimer</Button>
          </Row>
          <Row>
            <Button variant="primary" size="sm">Petit</Button>
            <Button variant="primary" size="md">Moyen</Button>
            <Button variant="primary" size="lg">Grand</Button>
            <Button variant="primary" loading>Envoi</Button>
            <Button variant="primary" disabled>Desactive</Button>
            <Button variant="secondary" disabled>Desactive</Button>
          </Row>
          <Row>
            <IconButton label="Copier" icon={Copy} />
            <IconButton label="Actualiser" icon={RefreshCw} variant="secondary" />
            <IconButton label="Rechercher" icon={Search} variant="outline" />
            <IconButton label="Nouveau" icon={Plus} variant="primary" />
            <IconButton label="Supprimer" icon={Trash2} variant="destructive" />
            <IconButton label="Copier (desactive)" icon={Copy} disabled />
          </Row>
        </Section>

        <Section title="Formulaires">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse e-mail" description="Utilisee pour la connexion." required>
              <Input type="email" placeholder="awa@exemple.com" />
            </Field>
            <Field label="Mot de passe" error="Au moins 8 caracteres.">
              <Input type="password" defaultValue="1234" />
            </Field>
            <Field label="Role">
              <Select
                defaultValue="USER"
                options={[
                  { value: 'USER', label: 'Utilisateur' },
                  { value: 'ADMIN', label: 'Administrateur' },
                  { value: 'SUPER_ADMIN', label: 'Super administrateur', disabled: true },
                ]}
              />
            </Field>
            <Field label="Desactive">
              <Input disabled placeholder="Non modifiable" />
            </Field>
          </div>
          <Field label="Message">
            <Textarea placeholder="Decrivez votre demande..." />
          </Field>
          <Checkbox label="Se souvenir de moi" description="Sur cet appareil uniquement." defaultChecked />
          <Switch label="Generation d'images" description="Kepler cree des images dans le chat." defaultChecked />
        </Section>

        <Section title="Badges, avatars, retours">
          <Row>
            <Badge>Utilisateur</Badge>
            <Badge tone="brand">Kepler</Badge>
            <Badge tone="success">Actif</Badge>
            <Badge tone="warning">En attente</Badge>
            <Badge tone="error">Suspendu</Badge>
            <Badge tone="info">Nouveau</Badge>
          </Row>
          <Row>
            <Avatar fallback="AT" size="sm" />
            <Avatar fallback="AT" />
            <Avatar fallback="AT" size="lg" />
            <Spinner />
            <div className="w-48"><Progress label="Creation de l'image" value={45} /></div>
            <div className="w-48"><Progress label="Recherche" /></div>
          </Row>
          <Alert tone="info" title="Information">Les reponses peuvent contenir des erreurs.</Alert>
          <Alert tone="success" title="Enregistre">Vos preferences ont ete mises a jour.</Alert>
          <Alert tone="warning" title="Quota bientot atteint">Il reste 12 images aujourd&apos;hui.</Alert>
          <Alert tone="error" title="Echec de l'envoi" action={<Button size="sm" variant="ghost">Reessayer</Button>}>
            Verifiez votre connexion.
          </Alert>
          <Row>
            <Button onClick={() => addToast('Conversation supprimee.', 'success')}>Toast succes</Button>
            <Button onClick={() => addToast("La generation de l'image a echoue.", 'error')}>Toast erreur</Button>
          </Row>
        </Section>

        <Section title="Surfaces">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="text-heading-md text-foreground">Carte</h3>
              <p className="mt-1 text-body-sm text-foreground-muted">Surface en relief, bordure discrete.</p>
            </Card>
            <Card interactive>
              <h3 className="text-heading-md text-foreground">Carte interactive</h3>
              <p className="mt-1 text-body-sm text-foreground-muted">Bordure renforcee au survol.</p>
            </Card>
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Card padding="none">
            <EmptyState icon={Search} title="Aucun resultat" description="Essayez une autre recherche." />
          </Card>
        </Section>

        <Section title="Overlays et navigation">
          <Row>
            <Dialog>
              <DialogTrigger asChild><Button>Ouvrir une fenetre</Button></DialogTrigger>
              <DialogContent
                title="Supprimer la conversation ?"
                description="Cette action est definitive."
                footer={<><Button variant="ghost">Annuler</Button><Button variant="destructive">Supprimer</Button></>}
              >
                <p className="text-body-md text-foreground-secondary">La conversation et ses images seront supprimees.</p>
              </DialogContent>
            </Dialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline">Menu</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem icon={Copy} hint="Ctrl C">Copier</DropdownMenuItem>
                <DropdownMenuItem icon={RefreshCw}>Regenerer</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={Trash2} destructive>Supprimer</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild><Button variant="ghost">Popover</Button></PopoverTrigger>
              <PopoverContent>
                <p className="text-label text-foreground">Modele</p>
                <p className="mt-1 text-body-sm text-foreground-muted">Gnoxe Brains 1 — rapide et polyvalent.</p>
              </PopoverContent>
            </Popover>
          </Row>
          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="securite">Securite</TabsTrigger>
              <TabsTrigger value="usage">Usage</TabsTrigger>
            </TabsList>
            <TabsContent value="general"><p className="text-body-md text-foreground-secondary">Contenu de l&apos;onglet General.</p></TabsContent>
            <TabsContent value="securite"><p className="text-body-md text-foreground-secondary">Contenu Securite.</p></TabsContent>
            <TabsContent value="usage"><p className="text-body-md text-foreground-secondary">Contenu Usage.</p></TabsContent>
          </Tabs>
        </Section>
      </div>
    </main>
  );
}
