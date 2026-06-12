// "Explorar este vídeo" — Q&A persistente sobre a transcrição (port do
// brain.ask + .explore do desktop). As perguntas ficam salvas por vídeo.
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ask, GeminiError, NoGeminiKeyError } from '../services/brain';
import * as db from '../services/db';
import { useAppStore } from '../store/useAppStore';
import type { QAItem, VideoRecord } from '../types';
import { colors, radius, spacing, typography } from '../theme';

interface Props {
  video: VideoRecord;
  onNeedSettings?: () => void;
}

export function QASection({ video, onNeedSettings }: Props) {
  const { geminiKey, model } = useAppStore();
  const [items, setItems] = useState<QAItem[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState(false);

  useEffect(() => {
    setItems(db.getQa(video.video_id));
  }, [video.video_id]);

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    setKeyError(false);
    try {
      const answer = await ask(video, q, items, { apiKey: geminiKey, model });
      db.addQa(video.video_id, q, answer);
      setItems(db.getQa(video.video_id));
      setQuestion('');
    } catch (e) {
      const isKey =
        e instanceof NoGeminiKeyError || (e instanceof GeminiError && e.isKeyError);
      setKeyError(isKey);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAsking(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Explorar este vídeo</Text>

      {items.map((qa) => (
        <View key={qa.id} style={styles.qa}>
          <Text style={styles.q}>▸ {qa.question}</Text>
          <View style={styles.aWrap}>
            <Text style={styles.a}>{qa.answer}</Text>
          </View>
        </View>
      ))}

      {asking && (
        <View style={styles.qa}>
          <Text style={styles.q}>▸ {question.trim()}</Text>
          <View style={styles.aWrap}>
            <Text style={[styles.a, styles.thinking]}>Consultando a transcrição…</Text>
          </View>
        </View>
      )}

      {error && (
        <View>
          <Text style={styles.err}>{error}</Text>
          {keyError && onNeedSettings && (
            <Pressable onPress={onNeedSettings}>
              <Text style={styles.errLink}>Abrir Configurações →</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.askRow}>
        <TextInput
          style={styles.input}
          value={question}
          onChangeText={setQuestion}
          placeholder="Pergunte algo sobre o vídeo…"
          placeholderTextColor={colors.text.tertiary}
          editable={!asking}
          onSubmitEditing={handleAsk}
          returnKeyType="send"
        />
        <Pressable
          onPress={handleAsk}
          disabled={asking || !question.trim()}
          style={({ pressed }) => [
            styles.askBtn,
            (asking || !question.trim()) && { opacity: 0.5 },
            pressed && { opacity: 0.8 },
          ]}
        >
          {asking ? (
            <ActivityIndicator size="small" color={colors.text.onGold} />
          ) : (
            <Text style={styles.askLabel}>Perguntar</Text>
          )}
        </Pressable>
      </View>
      <Text style={styles.hint}>
        A IA responde consultando a transcrição. As perguntas ficam salvas aqui.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  title: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  qa: { marginBottom: spacing.md },
  q: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  aWrap: {
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
  },
  a: { ...typography.small, color: colors.text.secondary, lineHeight: 19 },
  thinking: { fontStyle: 'italic', color: colors.text.tertiary },
  err: { ...typography.small, color: colors.accent.danger, marginBottom: 4 },
  errLink: {
    ...typography.small,
    color: colors.accent.gold,
    marginBottom: spacing.sm,
  },
  askRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    ...typography.small,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  askBtn: {
    backgroundColor: colors.accent.gold,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    minWidth: 92,
    alignItems: 'center',
  },
  askLabel: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text.onGold,
  },
  hint: { ...typography.label, color: colors.text.tertiary, marginTop: spacing.sm, textTransform: 'none', letterSpacing: 0 },
});
