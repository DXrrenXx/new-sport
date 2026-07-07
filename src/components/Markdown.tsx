// Markdown 渲染 + 编辑器组件。公告和使用说明都用它。
import { useMemo, useState } from 'react';
import { marked } from 'marked';

marked.setOptions({ breaks: true, gfm: true });

// 把「单独成行的图片网址」自动转成 Markdown 图片语法，方便管理员直接粘贴图片链接。
// 识别常见图片后缀（可带查询串），如 .png/.jpg/.jpeg/.gif/.webp/.svg/.bmp/.avif。
function autoImage(src: string): string {
  const imgUrl = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp|avif))(\?\S*)?$/i;
  return src
    .split('\n')
    .map((line) => {
      const t = line.trim();
      // 已经是图片/链接语法的行不处理，避免重复包裹
      if (imgUrl.test(t) && !t.startsWith('!') && !t.startsWith('[')) return `![](${t})`;
      return line;
    })
    .join('\n');
}

export function MarkdownView({ source, className = '' }: { source: string; className?: string }) {
  const html = useMemo(() => marked.parse(autoImage(source || '')) as string, [source]);
  return <div className={`markdown-body ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

// 带实时预览的 Markdown 编辑器
export function MarkdownEditor({
  value, onChange, rows = 10,
}: { value: string; onChange: (v: string) => void; rows?: number }) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden">
      <div className="flex border-b border-slate-200 bg-slate-50 text-sm">
        <button
          type="button"
          onClick={() => setTab('edit')}
          className={`px-4 py-2 ${tab === 'edit' ? 'bg-white font-semibold text-brand' : 'text-slate-500'}`}
        >
          编辑
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          className={`px-4 py-2 ${tab === 'preview' ? 'bg-white font-semibold text-brand' : 'text-slate-500'}`}
        >
          预览
        </button>
      </div>
      {tab === 'edit' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder="支持 Markdown：**加粗**、# 标题、- 列表、[链接](网址)、![图片](图片网址)"
          className="w-full p-3 font-mono text-sm outline-none resize-y"
        />
      ) : (
        <div className="p-3 min-h-[8rem]">
          <MarkdownView source={value} />
        </div>
      )}
    </div>
  );
}
