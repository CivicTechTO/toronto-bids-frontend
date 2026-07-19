// The shape of bids.json produced by the backend's build_export_document()
// (CivicTechTO/toronto-bids), post backend issues #144 (supplier_key on suppliers)
// and #145 (solicitations[].bids + top-level unlinked_bids). This file is the
// single source of truth for the frontend: every prepare module, page, and script
// imports these names — never redeclare, never rename.

export interface SyncSource { source: string; status: string; finished_at: string | null; rows_fetched: number; rows_upserted: number }
export interface Meta { generated_at: string; counts: Record<string, number>; sources: SyncSource[] }
export interface AwardRow { supplier_name_raw: string | null; supplier_id: number | null; award_amount: string | null; award_amount_numeric: number | null; award_amount_labelled?: number | null; award_amount_verdict?: string | null; award_date: string | null; source: string; first_seen: string; last_seen: string }
export interface BidRow { reference: string | null; document_number: string | null; bidder_name_raw: string; supplier_id: number | null; bid_price: string | null; bid_price_numeric: number | null; hst_basis: 'including' | 'excluding' | null; price_header: string | null; source: string; first_seen: string; last_seen: string }
export interface DocumentEntry { source: 'ariba_attachment' | 'award_summary' | 'staff_report'; name: string; path: string; type: string | null; size_bytes: number | null; url: string | null }
export interface AribaPosting { rfx_id: string; title: string | null; posting_type: string | null; status: string | null; customer_name: string | null; posted_date: string | null; close_date: string | null; categories: string[] | null; amount_min: string | null; amount_max: string | null; currency: string | null; public_posting_url: string | null; sourcing_url: string | null; external_rfx_id: string | null; source: string; first_seen: string; last_seen: string; document_number?: string | null }
export interface Solicitation { document_number: string; status: string; rfx_type: string | null; noip_type: string | null; form_type: string | null; title: string | null; description: string | null; issue_date: string; submission_deadline: string | null; category: string | null; division: string | null; buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null; wards: string | null; ariba_posting_link: string | null; source: string; title_source: string | null; first_seen: string; last_seen: string; awards: AwardRow[]; ariba_postings: AribaPosting[]; documents: DocumentEntry[]; bids: BidRow[] }
export interface NonCompetitive { workspace_number: string; supplier_name_raw: string | null; supplier_id: number | null; reason: string | null; contract_amount: string | null; contract_amount_numeric: number | null; contract_amount_labelled?: number | null; contract_amount_verdict?: string | null; contract_date: string | null; division: string | null; council_authority_link: string | null; source: string; first_seen: string; last_seen: string }
export interface SupplierRec { supplier_id: number; supplier_key: string; display_name: string; variants: string[]; first_seen: string; last_seen: string }
export interface CompositeAward { id: number; call_number: string; call_number_raw: string | null; reference: string | null; title: string | null; supplier_name_raw: string | null; supplier_id: number | null; award_value: string | null; award_value_numeric: number | null; source: string; first_seen: string; last_seen: string }
export interface BackgroundPdf { url: string; reference: string | null; kind: string; sha256: string | null; document_number: string | null; first_seen: string; last_seen: string }
export interface CouncilItem { reference: string; title: string | null; decision_text: string | null; first_seen: string; last_seen: string; background_pdfs: BackgroundPdf[]; bids: BidRow[] }
export interface SuspendedFirm { supplier_name_raw: string; status: string | null; start_date: string | null; end_date: string | null; suspension_type: string | null; council_authority: string | null; supplier_id: number | null; source: string; first_seen: string; last_seen: string }
export interface CapitalProject { name: string; contract_number: string | null; type_of_work: string | null; scope: string | null; delivery_division: string | null; owner_division: string | null; target_sourcing_year: string | null; target_award_year: string | null; sourcing_type: string | null; estimated_range: string | null; estimated_term_months: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencySolicitation { native_ref: string; title: string | null; status: string | null; posted_date: string | null; closing_date: string | null; portal_url: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencyAward { native_ref: string; supplier_name_raw: string | null; supplier_id: number | null; award_amount: string | null; award_amount_numeric: number | null; value_confidential: number; award_date: string | null; report_url: string | null; source: string; first_seen: string; last_seen: string }
export interface AgencyBid { native_ref: string; bidder_name_raw: string; supplier_id: number | null; bid_price: string | null; bid_price_numeric: number | null; report_url: string | null; source: string; first_seen: string; last_seen: string }
export interface Buyer { slug: string; name: string; kind: string; partnered: number; funding_share: number | null; platform: string | null; notes: string | null; first_seen: string; last_seen: string; solicitations: AgencySolicitation[]; awards: AgencyAward[]; bids: AgencyBid[] }
export interface ExportDoc { meta: Meta; solicitations: Solicitation[]; noncompetitive: NonCompetitive[]; suspended_firms: SuspendedFirm[]; suppliers: SupplierRec[]; capital_projects: CapitalProject[]; composite_awards: CompositeAward[]; council_items: CouncilItem[]; unlinked_ariba_postings: AribaPosting[]; unlinked_awards: (AwardRow & { document_number: string })[]; unlinked_bids: BidRow[]; buyers: Buyer[] }

// ---- Derived/prepared types (produced by src/prepare/*, consumed by pages) ----

export interface DedupedAward extends AwardRow { sources: string[] }
export interface DisplayTitle { text: string; untitled: boolean }
export interface SumResult { total: number; counted: number; skipped: number }
export interface Bridge { refToDoc: Map<string, string>; docToRefs: Map<string, string[]> }
export interface CompositeCall { call_number: string; reference: string | null; title: string | null; lines: CompositeAward[]; total: SumResult }
export interface SupplierRollup {
  slug: string; supplier: SupplierRec;
  awards: { document_number: string; sol: Solicitation | null; award: DedupedAward }[];
  compositeAwards: CompositeAward[];
  noncompetitive: NonCompetitive[];
  bids: { reference: string | null; document_number: string | null; bid: BidRow }[];
  suspended: SuspendedFirm[];
  totals: { cityAwards: SumResult; composite: SumResult; noncompetitive: SumResult };
}
export interface Headline { solicitations: number; awardedTotal: SumResult; awardedTotalTrimmed: SumResult; outlierAwardCount: number; noncompetitiveTotal: SumResult; openCount: number; bidCount: number; supplierCount: number }
export interface Prepared {
  doc: ExportDoc;
  generatedAt: string;
  dedupedAwardsByDoc: Map<string, DedupedAward[]>; // per solicitation AND per distinct unlinked_awards document_number
  bridge: Bridge;
  supplierSlugById: Map<number, string>;
  wsSlugByNumber: Map<string, string>;           // noncompetitive workspace_number → URL slug (wsSlug, Task 7)
  rollupsBySlug: Map<string, SupplierRollup>;
  compositeCalls: CompositeCall[];               // grouped, sorted by call_number
  councilByRef: Map<string, CouncilItem>;
  solByDoc: Map<string, Solicitation>;
  headline: Headline;
  counts: Record<string, number>;                // countsOf(doc) — served as counts.json
}
