import { Box, LayoutGrid } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';

export default function FallbackToggle() {
  const { use3DVisualizer, toggle3DVisualizer } = useAppStore();

  return (
    <button
      onClick={toggle3DVisualizer}
      className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors"
      title="Toggle between 3D and 2D fallback visualization"
    >
      {use3DVisualizer ? <LayoutGrid className="w-3.5 h-3.5" /> : <Box className="w-3.5 h-3.5" />}
      {use3DVisualizer ? 'Switch to 2D View' : 'Switch to 3D View'}
    </button>
  );
}
