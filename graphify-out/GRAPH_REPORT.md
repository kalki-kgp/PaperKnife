# Graph Report - PaperKnife  (2026-05-21)

## Corpus Check
- 103 files · ~347,453 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 865 nodes · 1947 edges · 58 communities (49 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f61e8c8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `A()` - 41 edges
2. `usePipeline()` - 41 edges
3. `NativeToolLayout()` - 26 edges
4. `getPdfMetaData()` - 24 edges
5. `I()` - 21 edges
6. `unlockPdf()` - 21 edges
7. `addActivity()` - 20 edges
8. `extractPdfSignature()` - 20 edges
9. `loadPdfDocument()` - 18 edges
10. `verifyUidaiPdfSignature()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `visualDiff()` --calls--> `pixelmatch`  [INFERRED]
  src/utils/pdfDiff.ts → package.json
- `QuickDropModal()` --calls--> `usePipeline()`  [EXTRACTED]
  src/App.tsx → src/utils/pipelineContext.tsx
- `PdfToTextTool()` --calls--> `usePipeline()`  [EXTRACTED]
  src/components/tools/PdfToTextTool.tsx → src/utils/pipelineContext.tsx
- `RearrangeTool()` --calls--> `usePipeline()`  [EXTRACTED]
  src/components/tools/RearrangeTool.tsx → src/utils/pipelineContext.tsx
- `PdfToImageTool()` --calls--> `usePipeline()`  [EXTRACTED]
  src/components/tools/PdfToImageTool.tsx → src/utils/pipelineContext.tsx

## Communities (58 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (17): Aa, bi(), E(), F(), G(), Ha(), I(), O() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.18
Nodes (39): object(), _(), a(), B(), c(), ct(), d(), dt() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (25): pixelmatch, buildSideOverlay(), CompareTool(), downloadDiffReport(), ExpandedCompareView(), HostSetter, Mode, OverlayWord (+17 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (28): App(), CompareTool, CompressTool, CropTool, ExtractImagesTool, GrayscaleTool, ImageToPdfTool, MergeTool (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (19): PdfPreviewProps, ExtractionMode, PdfToTextData, PdfToTextTool(), RotatePdfData, RotateTool(), SignaturePdfData, downloadFile() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (26): dependencies, asn1js, @capacitor/android, @capacitor/app, @capacitor/cli, @capacitor/core, @capacitor/filesystem, @capacitor/haptics (+18 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (14): B(), c(), chown(), D(), fchmod(), fchown(), fstat(), gb() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (24): Ab(), Bg(), Cb(), chdir(), createNode(), Eb(), Fb(), Fh() (+16 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (32): buildMinimalPdf(), buildSignedPdfFixture(), buildSignedPdfWithoutByteRangeLabel(), buildSignedPdfWithPageContentsRef(), buildX509SignedPdfFixture(), extractObjectStream(), injectByteRange(), PdfSignatureParseError (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.30
Nodes (11): onOfflineReady(), getInitialOfflineProgress(), getInitialOfflineStatus(), isReadyForThisBuild(), OfflineStatus, readyProgress, setOfflineStatus(), storedMark() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.24
Nodes (22): A(), Fg(), Gg(), $h(), Jh(), Kb(), Lb(), lh() (+14 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.19
Nodes (13): ag(), close(), fsync(), Ja(), Jf(), lstat(), readFile(), sg() (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (18): code:bash (# 1. Install dependencies), code:nginx (server {), code:yaml (# ~/.cloudflared/config.yml), code:bash (npx serve -s dist -l 3000), code:dockerfile (FROM node:20-alpine AS build), Deployment, Environment Variables, How to use it (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.16
Nodes (12): NativeToolLayout(), NativeToolLayoutProps, GrayscaleTool(), PdfData, ImageFile, MetadataPdfData, ImageFormat, PdfData (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (18): Bb(), chmod(), create(), Db(), dg(), hb(), Ib(), lchmod() (+10 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (15): FaqItem, ToolSeoContentProps, failureMessage(), formatSize(), MergeTool(), PdfFile, SortableItem(), SplitPdfFile (+7 more)

### Community 17 - "Community 17"
Cohesion: 0.18
Nodes (9): categoryColors, LayoutProps, Theme, Tool, ToolCategory, ViewMode, ViewModeContext, ViewModeContextType (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (76): arraysEqual(), computeEncryptionKey(), decryptPdfObjectBytes(), extractBytes(), getPdfFileEncryptionKey(), PADDING, padPassword(), PdfFileEncryptionKey (+68 more)

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (59): decryptPdfBytesForInspection(), DecryptPdfError, PdfEncryptionInfo, probePasswordWithPdfJs(), readPdfEncryptionInfo(), buildRevocationReport(), isSupportedSubFilter(), pdfHasEncryption() (+51 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (14): devDependencies, autoprefixer, postcss, tailwindcss, @types/bun, @types/pixelmatch, @types/react, @types/react-dom (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (14): ExtractImagesTool(), PdfData, MetadataTool(), PageNumberPdfData, PageNumberTool(), Position, RepairTool(), SignatureTool() (+6 more)

### Community 24 - "Community 24"
Cohesion: 0.19
Nodes (11): Analysis, analyzeFile(), bestProjection(), CompressPdfFile, CompressTool(), computeLosslessSize(), estimateRasterSize(), formatBytes() (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (10): categoryColors, editDistance(), isSubsequence(), makeAcronym(), normalizeSearchText(), scoreTokenAgainstWords(), scoreToolMatch(), toolAliases (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (10): categoryAccent, editDistance(), isSubsequence(), makeAcronym(), normalizeSearchText(), scoreTokenAgainstWords(), scoreToolMatch(), toolAliases (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.17
Nodes (9): clamp(), CropMargins, CropPdfData, CropScope, CropTool(), defaultMargins, DragHandle, presets (+1 more)

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (3): SuccessStateProps, RearrangePdfData, RearrangeTool()

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (5): CATEGORY_TINT, norm(), scoreMatch(), toolAliases, Window

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (8): Android / Capacitor, Architecture, code:bash (bun install              # install deps), Commands, Conventions, House rules, Project, Routing notes

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (8): Android / Capacitor, Architecture, code:bash (bun install              # install deps), Commands, Conventions, House rules, Project, Routing notes

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (8): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, strict, include

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (12): categoryAccent, LayoutProps, CATEGORY_LABEL, Props, hapticImpact(), hapticSuccess(), OfflineProgress, subscribeOfflineStatus() (+4 more)

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (4): Feedback(), feedbackOptions, FeedbackType, normalizeFeedbackType()

### Community 37 - "Community 37"
Cohesion: 0.43
Nodes (6): DesignVariant, persist(), readStored(), readUrlOverride(), resolveInitialVariant(), URL_ALIASES

### Community 38 - "Community 38"
Cohesion: 0.29
Nodes (6): pageIndices, pdfPage, resultBuffers, sortedIndices, sortedPages, transferables

### Community 39 - "Community 39"
Cohesion: 0.33
Nodes (5): license, name, private, type, version

### Community 40 - "Community 40"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 41 - "Community 41"
Cohesion: 0.53
Nodes (5): clearWorkspace(), getWorkspace(), openDB(), saveWorkspace(), WorkspaceData

### Community 42 - "Community 42"
Cohesion: 0.40
Nodes (4): enabledPlugins, frontend-design@claude-plugins-official, permissions, allow

## Knowledge Gaps
- **248 isolated node(s):** `composite`, `skipLibCheck`, `module`, `moduleResolution`, `allowSyntheticDefaultImports` (+243 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 5` to `Community 2`, `Community 39`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `pixelmatch` connect `Community 2` to `Community 5`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `composite`, `skipLibCheck`, `module` to the rest of the system?**
  _248 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.057624113475177305 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09269162210338681 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._