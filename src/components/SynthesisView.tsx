// Síntese expandida de um vídeo — port da .synth da UI do desktop: resumo,
// pontos-chave, meta (nº de fatos / primeiro trecho), citações com timestamp,
// ações e Q&A ("Explorar este vídeo"). Usada na tela de share E na expansão
// inline do feed.
import { useCallback, useState } from 'react';
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
import { useReadAloud } from '../hooks/useReadAloud';
import { useAppStore } from '../store/useAppStore';
import type { Veredito, VideoRecord } from '../types';
import { colors, radius, spacing, typography } from '../theme';
import { QASection } from './QASection';

const VEREDITO_UI: Record<Veredito, { label: string; color: string }> = {
  apoiada: { label: 'apoiada', color: colors.accent.success },
  mista: { label: 'mista', color: colors.accent.warning },
  contestada: { label: 'contestada', color: colors.accent.danger },
  sem_evidencia: { label: 'sem evidência', color: colors.text.tertiary },
};

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
  const { pillars, user, googleSignIn, geminiKey, ttsVoice } = useAppStore();
  const audio = useReadAloud();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(video.saved_drive === 1);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [note, setNote] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const read = video.read === 1;

  // Renderiza a nota do estado FRESCO do banco (inclui flashcards gerados e
  // perguntas/checagens marcadas para salvar) e grava no Drive. Reusada pelo
  // botão "Salvar nota" e pelas ações por item do Q&A/checagem.
  const persistNote = useCallback(async (): Promise<{ updated: boolean }> => {
    if (!user) {
      const u = await googleSignIn();
      if (!u) throw new Error('Conecte uma conta Google para salvar no Drive.');
    }
    const token = await getAccessToken();
    const fresh = db.getVideo(video.video_id) ?? video;
    const qa = db.getQa(video.video_id);
    const res = await saveMarkdown(token, noteFilename(fresh), renderNote(fresh, pillars, qa));
    db.setFlag(video.video_id, 'saved_drive', 1);
    setSaved(true);
    onChanged?.();
    return res;
  }, [user, googleSignIn, video, pillars, onChanged]);

  const handleSaveNote = async () => {
    setNote(null);
    setSaving(true);
    try {
      const { updated } = await persistNote();
      setNote({
        kind: 'ok',
        text: updated
          ? '✓ Nota atualizada em Drive/Aspis (sem duplicar).'
          : '✓ Nota criada em Drive/Aspis.',
      });
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

  const listenLabel =
    audio.status === 'loading'
      ? 'Gerando voz…'
      : audio.status === 'playing'
        ? '■ Parar'
        : '▶ Ouvir resumo';

  return (
    <View style={styles.root}>
      <Text style={styles.resumo}>{video.resumo}</Text>

      {!!video.resumo && (
        <View style={styles.listenWrap}>
          <Pressable
            onPress={() => audio.toggle(video.resumo, ttsVoice, geminiKey)}
            style={({ pressed }) => [styles.listenBtn, pressed && { opacity: 0.7 }]}
          >
            {audio.status === 'loading' ? (
              <ActivityIndicator size="small" color={colors.accent.gold} />
            ) : (
              <Text style={styles.listenLabel}>{listenLabel}</Text>
            )}
          </Pressable>
          {audio.error && (
            <View style={styles.listenErrWrap}>
              <Text style={styles.listenErr}>{audio.error}</Text>
              {audio.isKeyError && onNeedSettings && (
                <Pressable onPress={onNeedSettings}>
                  <Text style={styles.listenErrLink}>Abrir Configurações →</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

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

      {video.evidencias?.length > 0 && (
        <View style={styles.evidence}>
          <Text style={styles.evidenceTitle}>Evidências</Text>
          {video.evidencias.map((e, i) => {
            const ui = VEREDITO_UI[e.veredito] ?? VEREDITO_UI.sem_evidencia;
            return (
              <View key={i} style={styles.evidenceItem}>
                <View style={styles.evidenceHead}>
                  <View style={[styles.veredito, { borderColor: ui.color }]}>
                    <Text style={[styles.vereditoText, { color: ui.color }]}>{ui.label}</Text>
                  </View>
                  <Text style={styles.evidenceClaim}>{e.afirmacao}</Text>
                </View>
                {!!e.evidencia && <Text style={styles.evidenceBody}>{e.evidencia}</Text>}
                {e.fontes?.length > 0 && (
                  <Text style={styles.evidenceSources}>Fontes: {e.fontes.join('; ')}</Text>
                )}
              </View>
            );
          })}
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

      <QASection
        video={video}
        onNeedSettings={onNeedSettings}
        onPersistNote={persistNote}
        onChanged={onChanged}
      />
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
  listenWrap: { marginBottom: spacing.md, gap: spacing.sm },
  listenBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent.gold,
    minHeight: 30,
    minWidth: 120,
    justifyContent: 'center',
  },
  listenLabel: { ...typography.small, fontFamily: 'Inter_600SemiBold', color: colors.text.primary },
  listenErrWrap: { gap: 2 },
  listenErr: { ...typography.small, color: colors.accent.danger },
  listenErrLink: { ...typography.small, color: colors.accent.gold },
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
  evidence: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg.surface,
    gap: spacing.sm,
  },
  evidenceTitle: {
    ...typography.small,
    fontFamily: 'Inter_600SemiBold',
    color: colors.text.primary,
  },
  evidenceItem: { gap: 3 },
  evidenceHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  veredito: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
    marginTop: 1,
  },
  vereditoText: { ...typography.label, textTransform: 'none', letterSpacing: 0, fontSize: 10.5 },
  evidenceClaim: {
    ...typography.small,
    fontSize: 13,
    color: colors.text.primary,
    flex: 1,
    fontFamily: 'Inter_500Medium',
  },
  evidenceBody: { ...typography.small, fontSize: 12.5, lineHeight: 18, color: colors.text.secondary },
  evidenceSources: { ...typography.label, textTransform: 'none', letterSpacing: 0, color: colors.text.tertiary },
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
    borderColor: colors.border,
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
