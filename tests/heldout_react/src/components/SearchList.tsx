import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export interface Item {
  id: number;
  title: string;
  tags: string[];
  featured?: boolean;
}

type Props = {
  items: Item[];
  placeholder?: string;
  onSelect: (item: Item) => void;
};

export const SearchList = ({ items, placeholder = "Search…", onSelect }: Props) => {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.title.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {results.length === 0 && <p className="text-sm text-muted-foreground">Nothing matches "{query}".</p>}
      <ul className="divide-y rounded-md border">
        {results.map((item) => (
          <li key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted" onClick={() => onSelect(item)}>
            <span>{item.title}</span>
            <div className="flex gap-1">
              {item.featured && <Badge>Featured</Badge>}
              {item.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
