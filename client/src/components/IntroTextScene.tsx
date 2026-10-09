import { TextAnimationCollection } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  return (
    <div className="shader-frame">
      <TextAnimationCollection
        variant="threeui-intro"
        mode="dark"
        hue={0}
        saturation={1.00}
        brightness={1.00}
      />
    </div>
  );
}
