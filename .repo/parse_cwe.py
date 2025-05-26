import json
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Set, Optional

@dataclass
class CWEEntry:
    cwe: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    detail: Optional[str] = None
    parent: Set[str] = field(default_factory=set)
    children: Set[str] = field(default_factory=set)
    related: Set[str] = field(default_factory=set)
    scopes: Set[str] = field(default_factory=set)
    mitigation: Optional[str] = None
    languages: Set[str] = field(default_factory=set)

    def to_dict(self):
        # Convert sets to sorted lists for JSON serialization
        d = asdict(self)
        for k in ['parent', 'children', 'related', 'scopes', 'languages']:
            d[k] = sorted(list(d[k]))
        return d

    def add(self, key, values):
        # Merge values into set fields, never override
        if hasattr(self, key) and isinstance(getattr(self, key), set):
            if isinstance(values, (list, set)):
                getattr(self, key).update(values)
            elif values:
                getattr(self, key).add(values)
        else:
            setattr(self, key, values)

    def get(self, key):
        return getattr(self, key)

# --- Modular field extractors ---
def get_cwe_id(w: Dict[str, Any]) -> Optional[str]:
    return w.get('ID')

def get_name(w: Dict[str, Any]) -> Optional[str]:
    return w.get('Name')

def get_description(w: Dict[str, Any]) -> Optional[str]:
    return w.get('Description')

def get_detail(w: Dict[str, Any]) -> str:
    detail_parts = []
    if w.get('ExtendedDescription'):
        detail_parts.append(f"**Extended Description:**\n{w['ExtendedDescription']}\n")
    if w.get('AlternateTerms'):
        terms = w['AlternateTerms']
        if isinstance(terms, list):
            terms_md = ', '.join(t.get('Term', '') for t in terms if t.get('Term'))
        else:
            terms_md = terms.get('Term', '')
        if terms_md:
            detail_parts.append(f"**Alternate Terms:** {terms_md}\n")
    if w.get('ModesOfIntroduction'):
        modes = w['ModesOfIntroduction']
        if isinstance(modes, list):
            for m in modes:
                if m.get('Note'):
                    detail_parts.append(f"**Mode of Introduction:** {m['Note']}\n")
        elif modes.get('Note'):
            detail_parts.append(f"**Mode of Introduction:** {modes['Note']}\n")
    if w.get('BackgroundDetails'):
        detail_parts.append(f"**Background Details:**\n{w['BackgroundDetails']}\n")
    if w.get('CommonConsequences'):
        cc = w['CommonConsequences']
        if isinstance(cc, list):
            for c in cc:
                if c.get('Note'):
                    detail_parts.append(f"**Consequence Note:** {c['Note']}\n")
        elif cc.get('Note'):
            detail_parts.append(f"**Consequence Note:** {cc['Note']}\n")
    if w.get('DemonstrativeExamples'):
        ex = w['DemonstrativeExamples']
        if isinstance(ex, list):
            for e in ex:
                if e.get('Description'):
                    detail_parts.append(f"**Example:**\n{e['Description']}\n")
        elif ex.get('Description'):
            detail_parts.append(f"**Example:**\n{ex['Description']}\n")
    return '\n'.join(detail_parts)

def get_scopes(w: Dict[str, Any]) -> Set[str]:
    scopes = set()
    cc = w.get('CommonConsequences')
    if cc:
        if isinstance(cc, list):
            for c in cc:
                for s in c.get('Scope', []) if isinstance(c.get('Scope'), list) else [c.get('Scope')]:
                    if s and s != 'Other':
                        scopes.add(s)
        else:
            for s in cc.get('Scope', []) if isinstance(cc.get('Scope'), list) else [cc.get('Scope')]:
                if s and s != 'Other':
                    scopes.add(s)
    return scopes

def get_related_weaknesses(w: Dict[str, Any]):
    parents, children, related = set(), set(), set()
    rels = w.get('RelatedWeaknesses', [])
    rels = rels if isinstance(rels, list) else [rels]
    for rel in rels:
        if not rel or not rel.get('Nature') or not rel.get('CweID'):
            continue
        nature = rel['Nature']
        cweid = rel['CweID']
        if nature == 'ChildOf':
            parents.add(cweid)
        elif nature == 'ParentOf':
            children.add(cweid)
        elif nature in ('PeerOf', 'CanPrecede'):
            related.add(cweid)
    return parents, children, related

def get_mitigation(w: Dict[str, Any]) -> str:
    mitigation_parts = []
    if w.get('DetectionMethods'):
        dm = w['DetectionMethods']
        if isinstance(dm, list):
            for d in dm:
                if d.get('Description'):
                    mitigation_parts.append(f"**Detection:** {d['Description']}\n")
        elif dm.get('Description'):
            mitigation_parts.append(f"**Detection:** {dm['Description']}\n")
    if w.get('PotentialMitigations'):
        pm = w['PotentialMitigations']
        if isinstance(pm, list):
            for p in pm:
                if p.get('Description'):
                    mitigation_parts.append(f"**Mitigation:** {p['Description']}\n")
                if p.get('EffectivenessNotes'):
                    mitigation_parts.append(f"**Effectiveness:** {p['EffectivenessNotes']}\n")
        else:
            if pm.get('Description'):
                mitigation_parts.append(f"**Mitigation:** {pm['Description']}\n")
            if pm.get('EffectivenessNotes'):
                mitigation_parts.append(f"**Effectiveness:** {pm['EffectivenessNotes']}\n")
    return '\n'.join(mitigation_parts)

def get_languages(w: Dict[str, Any]) -> Set[str]:
    langs = set()
    ap = w.get('ApplicablePlatforms')
    if ap:
        aps = ap if isinstance(ap, list) else [ap]
        for plat in aps:
            if plat.get('Type') == 'Language' and plat.get('Name') and plat['Name'] != 'Other' and plat.get('Class') != 'Not Language-Specific':
                langs.add(plat['Name'])
    return langs

def process_related_weaknesses(w: Dict[str, Any], entry: CWEEntry, out: Dict[str, 'CWEEntry']):
    cwe_id = entry.cwe
    rels = w.get('RelatedWeaknesses', [])
    rels = rels if isinstance(rels, list) else [rels]
    for rel in rels:
        if not rel or not rel.get('Nature') or not rel.get('CweID'):
            continue
        nature = rel['Nature']
        rel_cweid = rel['CweID']
        # Ensure the related CWE exists in state
        if rel_cweid not in out:
            out[rel_cweid] = CWEEntry(cwe=rel_cweid)
        rel_entry = out[rel_cweid]
        if nature == 'ChildOf':
            entry.parent.add(rel_cweid)
            rel_entry.children.add(cwe_id)
        elif nature == 'ParentOf':
            entry.children.add(rel_cweid)
            rel_entry.parent.add(cwe_id)
        elif nature in ('PeerOf', 'CanPrecede'):
            entry.related.add(rel_cweid)
            rel_entry.related.add(cwe_id)

def parse_cwe_json(path):
    with open(path, 'r') as f:
        data = json.load(f)
    out: Dict[str, CWEEntry] = {}
    for w in data.get('Weaknesses', []):
        if not w:
            continue
        mapping_notes = w.get('MappingNotes', {})
        if mapping_notes.get('Usage', '').lower() == 'prohibited':
            continue
        cwe_id = get_cwe_id(w)
        if not cwe_id:
            continue
        if cwe_id not in out:
            entry = CWEEntry()
            entry.cwe = cwe_id
        else:
            entry = out[cwe_id]
        # Always merge, never override
        name = get_name(w)
        if name and not entry.name:
            entry.name = name
        desc = get_description(w)
        if desc and not entry.description:
            entry.description = desc
        detail = get_detail(w)
        if detail and not entry.detail:
            entry.detail = detail
        entry.add('scopes', get_scopes(w))
        # Use new process_related_weaknesses
        process_related_weaknesses(w, entry, out)
        mitigation = get_mitigation(w)
        if mitigation:
            if entry.mitigation:
                if mitigation not in entry.mitigation:
                    entry.mitigation += '\n' + mitigation
            else:
                entry.mitigation = mitigation
        entry.add('languages', get_languages(w))
        out[cwe_id] = entry
    return out

if __name__ == "__main__":
    result = parse_cwe_json('cwe.json')
    print(json.dumps([v.to_dict() for k, v in result.items()], indent=2, ensure_ascii=False))
