/* mascot.js is built as a React library, so it imports these four hooks at
   module scope and calls forwardRef() once at evaluation time to define its
   <Mascot> component. This sheet never renders that component — it drives the
   vanilla MascotRenderer class directly — but the imports still have to
   resolve or the module will not load. These are the smallest stubs that let
   evaluation finish. Nothing here is ever called at runtime.

   If a future sheet actually wants the React component, delete this file and
   map "react" to a real React build in the import map instead. */
export const forwardRef = (render) => render;
export const useRef = () => ({ current: null });
export const useImperativeHandle = () => {};
export const useEffect = () => {};
export default { forwardRef, useRef, useImperativeHandle, useEffect };
