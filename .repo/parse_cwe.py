#!/usr/bin/env python3
"""
This script processes CWE data, extracting relevant fields and relationships,
and outputs a JSON file that can be used for further analysis or integration.
"""

import json
import argparse
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Dict, Any, Set, Optional
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.panel import Panel
from rich.text import Text

console = Console()

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
    
    console.print(f"📄 [cyan]Loading CWE data from:[/cyan] {path}")
    
    out: Dict[str, CWEEntry] = {}
    weaknesses = data.get('Weaknesses', [])
    
    if not weaknesses:
        console.print("⚠️  [yellow]No weaknesses found in the input file[/yellow]")
        return out
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress:
        task = progress.add_task("🔍 Processing CWE entries...", total=len(weaknesses))
        
        processed_count = 0
        skipped_count = 0
        
        for w in weaknesses:
            progress.advance(task)
            
            if not w:
                skipped_count += 1
                continue
                
            mapping_notes = w.get('MappingNotes', {})
            if mapping_notes.get('Usage', '').lower() == 'prohibited':
                skipped_count += 1
                continue
                
            cwe_id = get_cwe_id(w)
            if not cwe_id:
                skipped_count += 1
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
            processed_count += 1
    
    console.print(f"✅ [green]Processed {processed_count} CWE entries[/green]")
    if skipped_count > 0:
        console.print(f"⏭️  [yellow]Skipped {skipped_count} entries (prohibited or invalid)[/yellow]")
    
    return out

if __name__ == "__main__":
    # Display header
    console.print(Panel.fit(
        Text("🛡️  CWE Data Parser", style="bold cyan", justify="center"),
        border_style="blue"
    ))
    
    parser = argparse.ArgumentParser(description='Parse CWE JSON file and output structured data')
    parser.add_argument('input', type=Path, help='Path to the CWE JSON file (e.g., cwe.json)')
    parser.add_argument('--overwrite', action='store_true', default=False, 
                       help='Overwrite output file (default: False to merge contents)')
    parser.add_argument('--pretty', action='store_true', default=False,
                       help='Enable pretty formatted output (default: False)')
    
    args = parser.parse_args()
    
    # Validate input file
    if not args.input.exists():
        console.print(f"❌ [red]Error: Input file not found:[/red] {args.input}")
        exit(1)
    
    if not args.input.suffix.lower() == '.json':
        console.print("⚠️  [yellow]Warning: Input file doesn't have .json extension[/yellow]")
    
    try:
        result = parse_cwe_json(args.input)
    except Exception as e:
        console.print(f"❌ [red]Error parsing CWE file:[/red] {e}")
        exit(1)
    
    # Get the output path relative to the script location
    parent_dir = Path(__file__).parent.parent
    output_path = parent_dir / 'shared' / 'cwes.json'
    
    # Ensure the shared directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    console.print(f"📁 [cyan]Output directory ensured:[/cyan] {output_path.parent}")
    
    # Prepare the JSON data
    new_cwe_data = {v.cwe: v.to_dict() for k, v in result.items()}
    
    if args.overwrite or not output_path.exists():
        # Simple overwrite or file doesn't exist
        final_data = list(new_cwe_data.values())
        if args.overwrite:
            console.print(f"🔄 [yellow]Overwriting existing file with {len(final_data)} CWE entries[/yellow]")
        else:
            console.print(f"📝 [green]Creating new file with {len(final_data)} CWE entries[/green]")
    else:
        # Merge with existing data, preferring new data for duplicates
        try:
            console.print("🔄 [cyan]Merging with existing data...[/cyan]")
            existing_content = output_path.read_text(encoding='utf-8')
            existing_data = json.loads(existing_content)
            
            # Convert existing data to dict keyed by CWE ID
            existing_cwe_data = {}
            for item in existing_data:
                if isinstance(item, dict) and 'cwe' in item:
                    existing_cwe_data[item['cwe']] = item
            
            # Merge: existing data + new data (new overwrites existing for same CWE ID)
            merged_data = {**existing_cwe_data, **new_cwe_data}
            final_data = list(merged_data.values())
            
            existing_count = len(existing_cwe_data)
            new_count = len(new_cwe_data)
            final_count = len(final_data)
            duplicates_count = existing_count + new_count - final_count
            
            console.print(f"📊 [green]Merge complete:[/green] {existing_count} existing + {new_count} new = {final_count} total CWE entries")
            if duplicates_count > 0:
                console.print(f"🔄 [yellow]Overwrote {duplicates_count} duplicate CWE entries with new data[/yellow]")
                
        except (json.JSONDecodeError, FileNotFoundError, KeyError) as e:
            console.print(f"⚠️  [yellow]Warning: Could not read/parse existing file ({e}), overwriting...[/yellow]")
            final_data = list(new_cwe_data.values())
    
    # Sort the final data by CWE ID for consistency
    final_data.sort(key=lambda x: x.get('cwe', ''))
    console.print("🔢 [cyan]Sorted entries by CWE ID[/cyan]")
    
    if args.pretty:
        json_content = json.dumps(final_data, indent=2, ensure_ascii=False)
        console.print("✨ [cyan]Using pretty formatting[/cyan]")
    else:
        json_content = json.dumps(final_data, ensure_ascii=False)
        console.print("📦 [cyan]Using compact formatting[/cyan]")

    # Write to file
    try:
        output_path.write_text(json_content, encoding='utf-8')
        file_size = output_path.stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        console.print(f"💾 [green]Successfully wrote CWE data to:[/green] {output_path}")
        console.print(f"📏 [cyan]File size:[/cyan] {file_size_mb:.2f} MB ({file_size:,} bytes)")
        console.print("🎉 [bold green]Processing completed successfully![/bold green]")
    except Exception as e:
        console.print(f"❌ [red]Error writing output file:[/red] {e}")
        exit(1)
