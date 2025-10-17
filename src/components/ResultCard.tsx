import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Calendar, Phone, Mail } from 'lucide-react';

interface ResultCardProps {
  data: any;
}

export default function ResultCard({ data }: ResultCardProps) {
  // Handle array of results
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Aucun résultat trouvé</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-2">
        {data.map((item, idx) => (
          <ResultCard key={idx} data={item} />
        ))}
      </div>
    );
  }

  // Single result - determine type and render accordingly
  const renderContent = () => {
    // Établissement
    if (data.nom && (data.type === 'client' || data.type === 'prospect')) {
      return (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{data.nom}</CardTitle>
              </div>
              <Badge variant={data.type === 'client' ? 'default' : 'secondary'}>
                {data.type}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.adresse && (
              <p className="text-sm text-muted-foreground">{data.adresse}</p>
            )}
            {data.secteur && (
              <p className="text-sm">
                <span className="font-medium">Secteur:</span> {data.secteur}
              </p>
            )}
            {data.statut && (
              <p className="text-sm">
                <span className="font-medium">Statut:</span> {data.statut}
              </p>
            )}
            {data.notes && (
              <p className="text-sm text-muted-foreground italic">{data.notes}</p>
            )}
          </CardContent>
        </>
      );
    }

    // Contact
    if (data.nom && data.prenom && !data.type) {
      return (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                {data.prenom} {data.nom}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.fonction && (
              <p className="text-sm">
                <span className="font-medium">Fonction:</span> {data.fonction}
              </p>
            )}
            {data.telephone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4" />
                <span>{data.telephone}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" />
                <span>{data.email}</span>
              </div>
            )}
          </CardContent>
        </>
      );
    }

    // Action
    if (data.type && ['appel', 'visite', 'mail', 'autre'].includes(data.type)) {
      return (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg capitalize">{data.type}</CardTitle>
              </div>
              <span className="text-sm text-muted-foreground">
                {new Date(data.date).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.etablissements?.nom && (
              <p className="text-sm">
                <span className="font-medium">Établissement:</span> {data.etablissements.nom}
              </p>
            )}
            {data.commentaire && (
              <p className="text-sm">{data.commentaire}</p>
            )}
            {data.resultat && (
              <p className="text-sm">
                <span className="font-medium">Résultat:</span> {data.resultat}
              </p>
            )}
          </CardContent>
        </>
      );
    }

    // Fallback for unknown structure
    return (
      <CardContent className="p-4">
        <pre className="text-xs overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    );
  };

  return (
    <Card className="bg-card shadow-soft">
      {renderContent()}
    </Card>
  );
}