// Síntese expandida de um vídeo — port da .synth da UI do desktop: resumo,
// pontos-chave, meta (nº de fatos / primeiro trecho), citações com timestamp,
// ações e Q&A ("Explorar este vídeo"). Usada na tela de share E na expansão
// inline do feed.
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { getAccessToken } from '../services/auth';
import * as db from '../services/db';
import { saveMarkdown } from '../services/drive';
import { noteFilename, renderNote, synthesisAsText } from '../services/notes';
import { useAppStore } from '../store/useAppStore';
import type { VideoRecord } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { QASection } from './QASection';

interface Props {
  video: VideoRecord;
  context: 'feed' | 'share';
  onChanged?: () => void; // read/saved mudou → recarregar lista
  onDiscard?: () => void; // só no share
  onNeedSettings?: () => void; // atalho para Configurações em erro de chave
}

function ActionBtn({
  label,
  done,
  busy,
  onPress,
}: {
  label: string;
  done?: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      disabled={busy}
      style={({ pressed }) => [
        styles.actionBtn,
        done && styles.actionBtnDone,
        pressed && { opacity: 0.7 },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.accent.gold} />
      ) : (
        <Text style={[styles.actionLabel, done && styles.actionLabelDone]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function SynthesisView({ video, context, onChanged, onDiscard, onNeedSettings }: Props) {
  const { pillars, user, googleSignIn } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(video.saved_drive === 1);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const read = video.read === 1;

  const handleSaveNote = async () => {
    setNote(null);
    setSaving(true);
    try {
      if (!user) {
        const u = await googleSignIn();
        if (!u) {
          setNote({ kind: 'err', text: 'Conecte uma conta Google para salvar no Drive.' });
          return;
        }
      }
      const token = await getAccessToken();
      const { updated } = await saveMarkdown(token, noteFilename(video), renderNote(video, pillars));
      db.setFlag(video.video_id, 'saved_drive', 1);
      setSaved(true);
      setNote({
        kind: 'ok',
        text: updated
          ? '✓ Nota atualizada em Drive/Aspis (sem duplicar).'
          : '✓ Nota criada em Drive/Aspis.',
      });
      onChanged?.();
    } catch (e) {
      setNote({ kind: 'err', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(synthesisAsText(video));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleRead = () => {
    db.setFlag(video.video_id, 'read', read ? 0 : 1);
    onChanged?.();
  };

  const handleDiscard = () => {
    db.deleteVideo(video.video_id);
    onDiscard?.();
  };

  const nFatos = video.fatos?.length || 0;
  const firstCite = video.citacoes?.[0];
  const metaBits: string[] = [];
  if (nFatos > 0) metaBits.push(`${nFatos} ${nFatos === 1 ? 'fato' : 'fatos'} para memorizar`);
  if (firstCite?.timestamp) metaBits.push(`trecho em ${firstCite.timestamp}`);
  if (video.content_source === 'metadata') metaBits.push('análise por metadados');

  return (
    <View style={styles.root}>
      <Text style={styles.resumo}>{video.resumo}</Text>

      {video.pontos_chave?.length > 0 && (
        <View style={styles.points}>
          {video.pontos_chave.map((p, i) => (
            <View key={i} style={styles.pointRow}>
              <Text style={styles.pointDash}>–</Text>
              <Text style={styles.pointText}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      {metaBits.length > 0 && <Text style={styles.metaLine}>{metaBits.join(' · ')}</Text>}

      {video.citacoes?.length > 0 && (
        <View style={styles.cites}>
          {video.citacoes.map((c, i) => (
            <View key={i} style={styles.citeRow}>
              <Text style={styles.citeText}>
                {c.texto}
                {c.timestamp ? <Text style={styles.citeTs}> — {c.timestamp}</Text> : null}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <ActionBtn
          label={saved ? '✓ Nota salva' : 'Salvar nota'}
          done={saved}
          busy={saving}
          onPress={handleSaveNote}
        />
        <ActionBtn label={copied ? '✓ Copiado' : 'Copiar'} done={copied} onPress={handleCopy} />
        <ActionBtn label="Abrir no YouTube" onPress={() => Linking.openURL(video.url)} />
        {context === 'feed' && (
          <ActionBtn label={read ? '✓ Lido' : 'Marcar lido'} done={read} onPress={handleToggleRead} />
        )}
        {context === 'share' && <ActionBtn label="Descartar" onPress={handleDiscard} />}
      </View>

      <Pressable onPress={() => setShowOriginal((v) => !v)}>
        <Text style={styles.reveal}>título original</Text>
      </Pressable>
      {showOriginal && <Text style={styles.originalTitle}>“{video.original_title}”</Text>}

      {note && (
        <Text style={[styles.note, note.kind === 'ok' ? styles.noteOk : styles.noteErr]}>
          {note.text}
        </Text>
      )}

      <QASection video={video} onNeedSettings={onNeedSettings} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.md },
  resumo: {
    ...typography.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  points: { marginBottom: spacing.md, gap: 5 },
  pointRow: { flexDirection: 'row', gap: 8 },
  pointDash: { ...typography.small, color: colors.text.tertiary, lineHeight: 19 },
  pointText: {
    ...typography.small,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.primary,
    flex: 1,
  },
  metaLine: { ...typography.label, color: colors.text.secondary, marginBottom: spacing.md },
  cites: { marginBottom: spacing.md, gap: 6 },
  citeRow: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent.goldDim,
    paddingLeft: spacing.md,
  },
  citeText: {
    ...typography.small,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  citeTs: { color: colors.text.tertiary, fontStyle: 'normal' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    minHeight: 32,
    justifyContent: 'center',
  },
  actionBtnDone: { borderColor: colors.border },
  actionLabel: { ...typography.small, color: colors.text.primary },
  actionLabelDone: { color: colors.text.secondary },
  reveal: {
    ...typography.label,
    color: colors.text.tertiary,
    marginTop: spacing.md,
    textTransform: 'none',
    letterSpacing: 0,
  },
  originalTitle: {
    ...typography.small,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: 6,
  },
  note: { ...typography.small, marginTop: spacing.sm },
  noteOk: { color: colors.accent.success },
  noteErr: { color: colors.accent.danger },
});
