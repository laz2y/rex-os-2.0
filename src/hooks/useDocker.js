import { useState } from "react";

export default function useDocker() {
  const [selectedContainer, setSelectedContainer] = useState(null);

  const openContainer = (container) => {
    setSelectedContainer(container);
  };

  const closeContainer = () => {
    setSelectedContainer(null);
  };

  return {
    selectedContainer,
    openContainer,
    closeContainer,
  };
}