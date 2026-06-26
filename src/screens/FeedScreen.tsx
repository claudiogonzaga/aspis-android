// Feed de inscrições ranqueado — port da lista do desktop (ui/index.html):
// chips de pilar, régua de estrelas mínimas, período Dia/Semana/Mês,
// "Mostrar lidos", expansão inline da síntese e rodapé com os filtrados.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { PeriodSegment } from '../components/PeriodSegment';
import { ScreenContainer } from '../components/ScreenContainer';
import { StarsRuler } from '../components/StarsRuler';
import { SynthesisView } from '../components/SynthesisView';
import { VideoRow } from '../components/VideoRow';
import { PERIODS, starsToThreshold } from '../constants/defaults';
import { getAccessToken, NotSignedInError } from '../services/auth';
import { GeminiError, NoGeminiKeyError } from '../services/brain';
import * as db from '../services/db';
import { refreshFeed } from '../services/pipeline';
import { checkForUpdate, type UpdateInfo } from '../services/updateChecker';
import { useAppStore } from '../store/useAppStore';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

export function FeedScreen({ navigation }: Props) {
  const {
    user,
    geminiKey,
    model,
    pillars,
    rules,
    noteLang,
    minStars,
    period,
    showRead,
    feedVersion,
    setMinStars,
    setPeriod,
    setShowRead,
    googleSignIn,
    bumpFeed,
  } = useAppStore();

  const [activePillar, setActivePillar] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'info' | 'ok' | 'err'; text: string; toSettings?: boolean } | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  // Checa atualização ao abrir (throttle de 6h dentro do serviço).
  useEffect(() => {
    checkForUpdate(false)
      .then((info) => {
        if (info.available) setUpdate(info);
      })
      .catch(() => {});
  }, []);

  const sinceIso = useMemo(
    () => new Date(Date.now() - PERIODS[period] * 3600 * 1000).toISOString(),
    [period, feedVersion, refreshing],
  );
  const threshold = starsToThreshold(minStars);

  const videos = useMemo(
    () =>
      db.getVideos({
        pillar: activePillar,
        minScore: threshold,
        sinceIso,
        includeRead: showRead,
      }),
    [activePillar, threshold, sinceIso, showRead, feedVersion],
  );
  const filteredOut = useMemo(
    () => db.countBelow(threshold, sinceIso),
    [threshold, sinceIso, feedVersion],
  );
  const newCount = videos.filter((v) => v.read === 0).length;

  const onRefresh = useCallback(async () => {
    setBanner(null);
    if (!geminiKey) {
      setBanner({
        kind: 'err',
        text: 'Cole a sua chave Gemini em Configurações para analisar vídeos.',
        toSettings: true,
      });
      return;
    }
    setRefreshing(true);
    try {
      let u = user;
      if (!u) u = await googleSignIn();
      if (!u) {
        setBanner({ kind: 'err', text: 'Conecte a sua conta Google para ler as inscrições.' });
        return;
      }
      const token = await getAccessToken();
      const result = await refreshFeed(
        token,
        { apiKey: geminiKey, model, pillars, rules, noteLang },
        period,
        minStars,
        (p) => {
          if (p.stage === 'subs') setBanner({ kind: 'info', text: 'Lendo as suas inscrições…' });
          else if (p.stage === 'playlists')
            setBanner({ kind: 'info', text: `Buscando vídeos novos… ${p.done}/${p.total} canais` });
          else setBanner({ kind: 'info', text: `Sintetizando… ${p.done}/${p.total} vídeos` });
        },
      );
      const bits = [
        `${result.processed} processado(s)`,
        `${result.above} acima do limiar`,
      ];
      if (result.skippedCached) bits.push(`${result.skippedCached} já analisados`);
      if (result.errors) bits.push(`${result.errors} com erro`);
      if (result.capped) bits.push(`${result.capped} ficam para a próxima`);
      setBanner({ kind: 'ok', text: `Pronto · ${bits.join(' · ')}` });
      bumpFeed();
    } catch (e) {
      const keyError =
        e instanceof NoGeminiKeyError || (e instanceof GeminiError && e.isKeyError);
      setBanner({
        kind: 'err',
        text: e instanceof NotSignedInError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e),
        toSettings: keyError,
      });
    } finally {
      setRefreshing(false);
    }
  }, [user, geminiKey, model, pillars, rules, noteLang, period, minStars, googleSignIn, bumpFeed]);

  const header = (
    <View style={styles.header}>
      {update?.available && update.latestVersion && (
        <Pressable
          onPress={() => {
            const url = update.downloadUrl ?? update.releaseUrl;
            if (url) Linking.openURL(url);
          }}
          style={styles.updateBanner}
        >
          <Text style={styles.updateBannerText}>
            ⬇ Nova versão v{update.latestVersion} disponível — toque para baixar
          </Text>
        </Pressable>
      )}
      <View style={styles.topbar}>
        <View style={styles.wordmark}>
          <Image source={require('../../assets/logo-mark.png')} style={styles.logo} />
          <Text style={styles.appName}>Aspis</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => navigation.navigate('Notes')} hitSlop={10}>
            <Text style={styles.headerAction}>Notas</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <Text style={styles.gear}>⚙</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {newCount} {newCount === 1 ? 'novo' : 'novos'}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <PeriodSegment value={period} onChange={setPeriod} />
      </View>

      <View style={styles.chips}>
        <Chip label="Todos" active={activePillar === null} onPress={() => setActivePillar(null)} />
        {pillars.map((p) => (
          <Chip
            key={p.id}
            label={p.mocName || p.nome}
            active={activePillar === p.id}
            onPress={() => setActivePillar(activePillar === p.id ? null : p.id)}
          />
        ))}
        <Chip
          label={showRead ? 'Ocultar lidos' : 'Mostrar lidos'}
          active={showRead}
          onPress={() => setShowRead(!showRead)}
        />
      </View>

      <View style={styles.rulerRow}>
        <StarsRuler value={minStars} onChange={setMinStars} />
      </View>

      {banner && (
        <Pressable
          onPress={banner.toSettings ? () => navigation.navigate('Settings') : undefined}
          style={[styles.banner, banner.kind === 'err' && styles.bannerErr]}
        >
          <Text
            style={[
              styles.bannerText,
              banner.kind === 'ok' && { color: colors.accent.success },
              banner.kind === 'err' && { color: colors.accent.danger },
            ]}
          >
            {banner.text}
            {banner.toSettings ? '  → Configurações' : ''}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const empty = !user ? (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Seu escudo contra o feed</Text>
      <Text style={styles.emptyText}>
        Conecte a sua conta Google para o Aspis ler as SUAS inscrições, analisar os vídeos novos
        e ranquear o que realmente serve aos seus pilares.
      </Text>
      <Button
        label="Conectar conta Google"
        onPress={async () => {
          const u = await googleSignIn().catch(() => null);
          if (u) onRefresh();
        }}
        fullWidth={false}
        style={{ marginTop: spacing.xl, alignSelf: 'center' }}
      />
      <Text style={styles.emptyHint}>
        Dica: você já pode usar o Compartilhar → Aspis no YouTube, mesmo sem conectar.
      </Text>
    </View>
  ) : (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        Nada por aqui no período. Puxe a lista para baixo para buscar vídeos novos.
      </Text>
    </View>
  );

  return (
    <ScreenContainer edges={['top']}>
      <FlatList
        data={videos}
        keyExtractor={(v) => v.video_id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          videos.length > 0 || filteredOut > 0 ? (
            <Text style={styles.footer}>
              {filteredOut} {filteredOut === 1 ? 'vídeo filtrado' : 'vídeos filtrados'}
            </Text>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent.gold}
            colors={[colors.accent.gold]}
            progressBackgroundColor={colors.bg.gradientEnd}
          />
        }
        renderItem={({ item }) => (
          <VideoRow
            video={item}
            pillars={pillars}
            expanded={expandedId === item.video_id}
            onPress={() =>
              setExpandedId(expandedId === item.video_id ? null : item.video_id)
            }
          >
            <SynthesisView
              video={item}
              context="feed"
              onChanged={bumpFeed}
              onNeedSettings={() => navigation.navigate('Settings')}
            />
          </VideoRow>
        )}
        contentContainerStyle={styles.list}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Recuos maiores que a faixa da grega (~20px) para o conteúdo ficar DENTRO
  // da moldura de meandro, sem o escudo/logo sobrepor a borda.
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.xl + spacing.xs, paddingBottom: spacing.sm },
  updateBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceStrong,
    borderColor: colors.accent.gold,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  updateBannerText: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.text.primary,
    textAlign: 'center',
  },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 44, height: 44, borderRadius: 22 },
  appName: { ...typography.title, color: colors.text.primary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerAction: { ...typography.bodyMedium, fontSize: 15, color: colors.accent.gold },
  gear: { fontSize: 22, color: colors.text.secondary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  metaText: { ...typography.small, color: colors.text.secondary },
  metaDot: { color: colors.text.tertiary },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: spacing.lg,
  },
  rulerRow: { marginTop: spacing.lg },
  banner: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.bg.surface,
  },
  bannerErr: { backgroundColor: 'rgba(228,120,120,0.10)' },
  bannerText: { ...typography.small, color: colors.text.secondary },
  empty: { paddingVertical: spacing.xxxl, paddingHorizontal: spacing.lg },
  emptyTitle: {
    ...typography.subtitle,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...typography.small,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  footer: {
    ...typography.small,
    color: colors.text.tertiary,
    textAlign: 'center',
    paddingVertical: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
