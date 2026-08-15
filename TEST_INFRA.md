# E2E Test Infra: atTrack sqlite-vec & Hybrid RAG Retrieval

## Test Philosophy
- Opaque-box, requirement-driven. No internal private method dependencies.
- Dual Track: 4-tier requirement verification + 1-tier adversarial coverage hardening.
- Zero-regression guarantee: Standard SQL and SQLite FTS5 search work alongside sqlite-vec RAG.

## Feature Inventory & Test Mapping
| # | Feature | Requirement Source | Tier 1 (Coverage >=5) | Tier 2 (Boundary >=5) | Tier 3 (Pairwise) | Tier 4 (Scenario) |
|---|---------|-------------------|:---------------------:|:---------------------:|:-----------------:|:-----------------:|
| F1 | `sqlite-vec` Extension Loading | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F2 | Vector Database Schema | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| F3 | FTS5 & Relational Preservation | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 | ✓ | ✓ |
| F4 | Text Chunking Service | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F5 | BYOK Embeddings Service | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F6 | Async Background Queue Indexing | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| F7 | Strict Relational Hybrid Retrieval | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F8 | Semantic Memory Recall | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| F9 | Chatbot Grounding Integration | ORIGINAL_REQUEST §R4.1 | 5 | 5 | ✓ | ✓ |
| F10 | Resume & Job Fit Matrix | ORIGINAL_REQUEST §R4.2 | 5 | 5 | ✓ | ✓ |
| F11 | Grounded AI Tools | ORIGINAL_REQUEST §R4.3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Node.js test runner / vitest / tsx test script (`scripts/test-sqlite-vec-rag.ts`)
- **Compilation Check**: `npx tsc --noEmit`
- **Build Check**: `npx next build --webpack`

## Test Tiers Breakdown
- **Tier 1: Feature Coverage (>=55 test cases)**:
  - Verify sqlite-vec extension loads and `vec_version()` returns valid string.
  - Verify `document_chunks`, `vec_document_chunks`, `vec_memories` table structures.
  - Verify relational queries and FTS5 `omni_search_index` queries function normally.
  - Verify text chunker breaks down documents into 300-500 token chunks with overlap.
  - Verify BYOK embedding service generates 768-dim float32 vectors.
  - Verify hybrid retrieval performs SQL scoping (`user_id`, `source_id`) before vector distance sorting.
  - Verify memory semantic recall fetches top-3 matches.
- **Tier 2: Boundary & Corner Cases (>=55 test cases)**:
  - Empty text chunking, single character text, very large text (>10,000 words).
  - Missing BYOK API keys (graceful fallback without crashing).
  - Multi-tenant relational isolation (User A cannot retrieve User B's vector chunks).
  - Vector cosine distance with identical, orthogonal, and opposing vectors.
  - Zero-matches query scenario.
- **Tier 3: Cross-Feature Interactions**:
  - Upload resume -> chunk -> embed -> query via chatbot -> citation verify.
  - Add job notes -> chunk -> embed -> compute job-resume fit breakdown in InsightsTab.
  - Update memory -> re-embed -> search via chatbot tool.
  - Delete job / resume -> cascade delete chunks from relational & vector tables.
- **Tier 4: Real-World Scenarios**:
  - Full recruitment cycle: Candidate applies to job with resume -> fit score calculated with evidence-backed bullets -> chat interview prep queries role notes -> cover letter generated with grounded context.
- **Tier 5: Adversarial Coverage Hardening**:
  - White-box branch gap analysis and adversarial injection tests.

## Coverage Thresholds
- Tier 1: >= 55 test cases
- Tier 2: >= 55 test cases
- Tier 3: >= 11 interaction tests
- Tier 4: >= 5 end-to-end scenarios
- Tier 5: Complete coverage with zero untested edge cases.
