import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Rappel {
  id: string;
  type: string;
  date: string;
  rappel_le: string;
  commentaire: string;
  etablissement_id: string;
  contact_id?: string;
}

export default function RappelsBadge({ userId }: { userId: string }) {
  const [rappelsToday, setRappelsToday] = useState<Rappel[]>([]);
  const [rappelsWeek, setRappelsWeek] = useState<Rappel[]>([]);
  const [count, setCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadRappels();
  }, [userId]);

  const loadRappels = async () => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    
    const endOfWeek = new Date(startOfDay);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    try {
      // Rappels du jour
      const { data: todayData } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .not('rappel_le', 'is', null)
        .gte('rappel_le', startOfDay.toISOString())
        .lt('rappel_le', endOfDay.toISOString())
        .order('rappel_le', { ascending: true });

      // Rappels de la semaine
      const { data: weekData } = await supabase
        .from('actions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .not('rappel_le', 'is', null)
        .gte('rappel_le', endOfDay.toISOString())
        .lt('rappel_le', endOfWeek.toISOString())
        .order('rappel_le', { ascending: true });

      setRappelsToday(todayData || []);
      setRappelsWeek(weekData || []);
      setCount((todayData?.length || 0));
    } catch (error) {
      console.error('Error loading rappels:', error);
    }
  };

  const markAsDone = async (id: string) => {
    try {
      const { error } = await supabase
        .from('actions')
        .update({ resultat: 'Fait', rappel_le: null })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Rappel marqué comme fait',
        description: 'Le rappel a été marqué comme terminé'
      });

      loadRappels();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const postpone = async (id: string) => {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const { error } = await supabase
        .from('actions')
        .update({ rappel_le: tomorrow.toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Rappel reporté',
        description: 'Le rappel a été reporté à demain'
      });

      loadRappels();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const RappelItem = ({ rappel }: { rappel: Rappel }) => (
    <div className="p-3 bg-card border rounded-lg space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium">{rappel.type}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(rappel.rappel_le), 'PPp', { locale: fr })}
          </p>
          {rappel.commentaire && (
            <p className="text-sm text-muted-foreground mt-1">{rappel.commentaire}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => markAsDone(rappel.id)}
          className="flex-1"
        >
          Fait
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => postpone(rappel.id)}
          className="flex-1"
        >
          Reporter
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {count}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Rappels</SheetTitle>
        </SheetHeader>
        <Tabs defaultValue="today" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="today">
              Aujourd'hui ({rappelsToday.length})
            </TabsTrigger>
            <TabsTrigger value="week">
              Cette semaine ({rappelsWeek.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="space-y-3 mt-4">
            {rappelsToday.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun rappel pour aujourd'hui
              </p>
            ) : (
              rappelsToday.map(rappel => <RappelItem key={rappel.id} rappel={rappel} />)
            )}
          </TabsContent>
          <TabsContent value="week" className="space-y-3 mt-4">
            {rappelsWeek.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun rappel pour cette semaine
              </p>
            ) : (
              rappelsWeek.map(rappel => <RappelItem key={rappel.id} rappel={rappel} />)
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
