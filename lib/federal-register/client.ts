export interface FRApiDocument {
  document_number: string;
  title: string;
  abstract: string | null;
  agencies: { name: string }[];
  publication_date: string;
  html_url: string;
  type: string;
}

// Types that require internal policy action from healthcare organizations
const COMPLIANCE_TYPES = new Set(["Proposed Rule", "Rule", "Interim Rule"]);

export async function fetchProposedRegulations(opts?: {
  perPage?: number;
}): Promise<FRApiDocument[]> {
  const fields = [
    "document_number",
    "title",
    "abstract",
    "agencies",
    "publication_date",
    "html_url",
    "type",
  ];

  // Fetch a larger batch since we filter to compliance-relevant types client-side.
  // Using term search anchored to HHS/CMS agencies to surface rules over notices.
  const fetchSize = Math.max((opts?.perPage ?? 20) * 4, 100);

  const parts: string[] = [
    "conditions%5Bagencies%5D%5B%5D=health-and-human-services-department",
    "conditions%5Bagencies%5D%5B%5D=centers-for-medicare-medicaid-services",
    ...fields.map((f) => `fields%5B%5D=${encodeURIComponent(f)}`),
    "order=newest",
    `per_page=${fetchSize}`,
  ];

  const url = `https://www.federalregister.gov/api/v1/documents.json?${parts.join("&")}`;

  const res = await fetch(url, { next: { revalidate: 0 } });

  if (!res.ok) {
    throw new Error(`Federal Register unavailable (${res.status})`);
  }

  const data = await res.json();
  const all = (data.results ?? []) as FRApiDocument[];

  // Filter to rule types and cap at requested size
  const rules = all.filter((d) => COMPLIANCE_TYPES.has(d.type));
  return rules.slice(0, opts?.perPage ?? 20);
}
