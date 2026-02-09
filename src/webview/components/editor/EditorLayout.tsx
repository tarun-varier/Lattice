import { Toolbar } from '../toolbar/Toolbar';
import { Canvas } from '../canvas/Canvas';
import { OutputPanel } from '../output/OutputPanel';

export function EditorLayout() {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Top toolbar */}
      <Toolbar />

      {/* Main content area: Canvas (left) + Output (right) */}
      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 min-w-0 border-r border-border">
          <Canvas />
        </div>

        {/* Output panel */}
        <div className="w-[420px] min-w-[320px] flex-shrink-0">
          <OutputPanel />
        </div>
      </div>
    </div>
  );
}
