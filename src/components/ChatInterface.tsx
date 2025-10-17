import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MessageBubble from './MessageBubble';
import ResultCard from './ResultCard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_results?: any[];
  timestamp: Date;
}

export default function ChatInterface({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-crm-chat', {
        body: {
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          userId
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        tool_results: data.tool_results,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

      // If there are tool calls, we need a second call for the final response
      if (data.tool_calls && data.tool_results) {
        const { data: finalData, error: finalError } = await supabase.functions.invoke('ai-crm-chat', {
          body: {
            messages: [
              ...messages,
              userMessage,
              {
                role: 'assistant',
                content: data.content || '',
                tool_calls: data.tool_calls
              },
              ...data.tool_results.map((result: any) => ({
                role: 'tool',
                content: result.output,
                tool_call_id: result.tool_call_id
              }))
            ],
            userId
          }
        });

        if (finalError) throw finalError;

        const finalMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: finalData.content,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, finalMessage]);
      }

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Une erreur est survenue',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b bg-card p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-primary">CRM ADAPTEL Lyon</h1>
          <p className="text-sm text-muted-foreground">Assistant commercial intelligent</p>
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold mb-2">Bonjour ! Comment puis-je vous aider ?</h2>
              <p className="text-muted-foreground mb-6">
                Décrivez vos actions commerciales en langage naturel
              </p>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                <div className="p-4 bg-card rounded-lg border">
                  <p className="text-sm text-muted-foreground">Exemple :</p>
                  <p className="text-sm mt-1">"J'ai rencontré le directeur du Novotel Bron hier"</p>
                </div>
                <div className="p-4 bg-card rounded-lg border">
                  <p className="text-sm text-muted-foreground">Exemple :</p>
                  <p className="text-sm mt-1">"Quels sont mes rappels de cette semaine ?"</p>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id}>
              <MessageBubble message={message} />
              {message.tool_results && message.tool_results.length > 0 && (
                <div className="mt-2 space-y-2">
                  {message.tool_results.map((result, idx) => {
                    const parsed = JSON.parse(result.output);
                    if (parsed.success && parsed.data) {
                      return <ResultCard key={idx} data={parsed.data} />;
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">L'assistant réfléchit...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-4">
        <div className="max-w-4xl mx-auto flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Décrivez votre action commerciale..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primary-hover"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}