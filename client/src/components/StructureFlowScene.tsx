import { StructureFlowCollection } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  return (
    <div className="shader-frame">
      <StructureFlowCollection
        variant="fluid-field"
        hue={0}
        saturation={1.00}
        brightness={1.00}
      />
    </div>
  );
}
