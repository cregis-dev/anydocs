'use client';

import { useEffect, useId, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidViewerProps {
  code: string;
}

export function MermaidViewer({ code }: MermaidViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgStr, setSvgStr] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const idPrefix = useId().replace(/:/g, '');

  useEffect(() => {
    let isMounted = true;
    
    const renderChart = async () => {
      if (!code.trim()) {
        setSvgStr('');
        setError(null);
        return;
      }
      
      try {
        const isDarkMode = 
          typeof document !== 'undefined' && 
          document.documentElement.classList.contains('dark');
          
        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? 'dark' : 'neutral',
          securityLevel: 'loose',
          fontFamily: 'inherit',
          flowchart: {
            htmlLabels: false,
          },
        });

        // Use a unique ID for each graph to avoid collisions
        const id = `mermaid-${idPrefix}`;
        
        // mermaid.render returns an object { svg, bindFunctions }
        const result = await mermaid.render(id, code);
        
        if (isMounted) {
          setSvgStr(result.svg);
          setError(null);
        }
      } catch (error: unknown) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : 'Failed to render Mermaid diagram';
          setError(message);
          console.error('[MermaidViewer] Render error:', error);
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [code, idPrefix]);

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-900 rounded-md text-sm font-mono overflow-auto">
        <strong>Mermaid Syntax Error:</strong>
        <pre className="mt-2 text-xs">{error}</pre>
      </div>
    );
  }

  if (!svgStr) {
    return <div className="p-4 text-center text-sm text-gray-400 border border-dashed rounded-md">Empty Mermaid Diagram</div>;
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid-wrapper flex w-full justify-center overflow-x-auto py-6 transition-all [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svgStr }} 
    />
  );
}
