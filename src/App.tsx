import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  exportToCanvas,
  exportToSvg,
  exportToBlob,
  exportToClipboard,
  Excalidraw,
  useHandleLibrary,
  MIME_TYPES,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
  restoreElements,
  LiveCollaborationTrigger,
  MainMenu,
  Footer,
  Sidebar
} from "@excalidraw/excalidraw";
import {
  AppState,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
  Gesture,
  LibraryItems,
  PointerDownState as ExcalidrawPointerDownState
} from "@excalidraw/excalidraw/types/types";

import ExampleSidebar from "./sidebar/ExampleSidebar";

import "./App.scss";
import initialData from "./initialData";

import { NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { nanoid } from "nanoid";
import CustomFooter from "./CustomFooter";
import MobileFooter from "./MobileFooter";
import {
  resolvablePromise,
  withBatchedUpdates,
  withBatchedUpdatesThrottled,
  distance2d
} from "./utils";
import { ResolvablePromise } from "@excalidraw/excalidraw/types/utils";

declare global {
  interface Window {
    ExcalidrawLib: any;
  }
}

type Comment = {
  x: number;
  y: number;
  value: string;
  id?: string;
};

type PointerDownState = {
  x: number;
  y: number;
  hitElement: Comment;
  onMove: any;
  onUp: any;
  hitElementOffsets: {
    x: number;
    y: number;
  };
};
// This is so that we use the bundled excalidraw.development.js file instead
// of the actual source code

const COMMENT_ICON_DIMENSION = 32;
const COMMENT_INPUT_HEIGHT = 50;
const COMMENT_INPUT_WIDTH = 150;

export default function App() {
  const appRef = useRef<any>(null);
  const [viewModeEnabled, setViewModeEnabled] = useState(false);
  const [zenModeEnabled, setZenModeEnabled] = useState(false);
  const [gridModeEnabled, setGridModeEnabled] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [canvasUrl, setCanvasUrl] = useState<string>("");
  const [theme, setTheme] = useState("dark");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [commentIcons, setCommentIcons] = useState<{ [id: string]: Comment }>(
    {}
  );
  const [comment, setComment] = useState<Comment | null>(null);

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise = resolvablePromise();
  }

  const [
    excalidrawAPI,
    setExcalidrawAPI
  ] = useState<ExcalidrawImperativeAPI | null>(null);

  useHandleLibrary({ excalidrawAPI });

  const addImage = async (imageName: string) => {
    if (!excalidrawAPI) {
      return;
    }
    const res = await fetch(`${imageName}`);
    const imageData = await res.blob();
    const reader = new FileReader();
    reader.readAsDataURL(imageData);

    reader.onload = function () {
      const imagesArray: BinaryFileData[] = [
        {
          id: imageName as BinaryFileData["id"],
          dataURL: reader.result as BinaryFileData["dataURL"],
          mimeType: MIME_TYPES.jpg,
          created: 1644915140367,
          lastRetrieved: 1644915140367
        }
      ];

    //   initialStatePromiseRef.current.promise.resolve(initialData);
    console.log("imagesArray", imagesArray)
      excalidrawAPI.addFiles(imagesArray);
      console.log(excalidrawAPI.getFiles(), 'files')
      console.log(excalidrawAPI.getSceneElements())
      const currentElements = excalidrawAPI.getSceneElements();
      //update scene
      excalidrawAPI.updateScene({
        elements: [
          ...currentElements,
          {
            id: imagesArray[0].id,
            type: "image",
            x: 697.5067170062408,
            y: -745.50415625,
            width: 231.30325348751828,
            height: 231.64340533088227,
            angle: 0,
            strokeColor: "transparent",
            backgroundColor: "transparent",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            groupIds: [],
            seed: 707269846,
            version: 143,
            versionNonce: 2028982666,
            isDeleted: false,
            boundElements: null,
            updated: 1644914782403,
            link: null,
            locked: false,
            roundness: null, // add this line
            fileId: imagesArray[0].id, 
            status: "pending",
            scale: [1, 1] 
          },
        ],
      });
    }
  };

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const fetchData = async () => {
      const res = await fetch("/excalidraw-poc/element-1.png");
      const imageData = await res.blob();
      const reader = new FileReader();
      reader.readAsDataURL(imageData);

      reader.onload = function () {
        const imagesArray: BinaryFileData[] = [
          {
            id: "rocket" as BinaryFileData["id"],
            dataURL: reader.result as BinaryFileData["dataURL"],
            mimeType: MIME_TYPES.jpg,
            created: 1644915140367,
            lastRetrieved: 1644915140367
          }
        ];

        //@ts-ignore
        initialStatePromiseRef.current.promise.resolve(initialData);
        excalidrawAPI.addFiles(imagesArray);
      };
    };
    fetchData();
  }, [excalidrawAPI]);

  const onCopy = async (type: "png" | "svg" | "json") => {
    if (!excalidrawAPI) {
      return false;
    }
    await exportToClipboard({
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
      type
    });
    window.alert(`Copied to clipboard as ${type} successfully`);
  };

  const [pointerData, setPointerData] = useState<{
    pointer: { x: number; y: number };
    button: "down" | "up";
    pointersMap: Gesture["pointers"];
  } | null>(null);

  const onPointerDown = (
    activeTool: AppState["activeTool"],
    pointerDownState: ExcalidrawPointerDownState
  ) => {
    if (activeTool.type === "custom" && activeTool.customType === "comment") {
      const { x, y } = pointerDownState.origin;
      setComment({ x, y, value: "" });
    }
  };

  const onPointerMoveFromPointerDownHandler = (
    pointerDownState: PointerDownState
  ) => {
    return withBatchedUpdatesThrottled((event) => {
      if (!excalidrawAPI) {
        return false;
      }
      const { x, y } = viewportCoordsToSceneCoords(
        {
          clientX: event.clientX - pointerDownState.hitElementOffsets.x,
          clientY: event.clientY - pointerDownState.hitElementOffsets.y
        },
        excalidrawAPI.getAppState()
      );
      setCommentIcons({
        ...commentIcons,
        [pointerDownState.hitElement.id!]: {
          ...commentIcons[pointerDownState.hitElement.id!],
          x,
          y
        }
      });
    });
  };
  const onPointerUpFromPointerDownHandler = (
    pointerDownState: PointerDownState
  ) => {
    return withBatchedUpdates((event) => {
      window.removeEventListener("pointermove", pointerDownState.onMove);
      window.removeEventListener("pointerup", pointerDownState.onUp);
      excalidrawAPI?.setActiveTool({ type: "selection" });
      const distance = distance2d(
        pointerDownState.x,
        pointerDownState.y,
        event.clientX,
        event.clientY
      );
      if (distance === 0) {
        if (!comment) {
          setComment({
            x: pointerDownState.hitElement.x + 60,
            y: pointerDownState.hitElement.y,
            value: pointerDownState.hitElement.value,
            id: pointerDownState.hitElement.id
          });
        } else {
          setComment(null);
        }
      }
    });
  };

  const renderMenu = () => {
    return (
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.Export />
        <MainMenu.Separator />


        <MainMenu.Separator />
        <MainMenu.ItemCustom>
          <button
            style={{ height: "2rem" }}
            onClick={() => window.alert("custom menu item")}
          >
            custom item
          </button>
        </MainMenu.ItemCustom>
        <MainMenu.DefaultItems.Help />

        {excalidrawAPI && <MobileFooter excalidrawAPI={excalidrawAPI} />}
      </MainMenu>
    );
  };
  return (
    <div className="App" ref={appRef}>
      <h1> Excalidraw Kurukuru Demo</h1>
      {imageDataUrl && <img src={imageDataUrl} />} {/* Add this line */}
      <ExampleSidebar>
        <div className="button-wrapper">
          <button
            className="reset-scene"
            onClick={() => {
              excalidrawAPI?.resetScene();
            }}
          >
            Reset Scene
          </button>

          <label>
            <input
              type="checkbox"
              checked={viewModeEnabled}
              onChange={() => setViewModeEnabled(!viewModeEnabled)}
            />
            View mode
          </label>

          <label>
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={() => {
                let newTheme = "light";
                if (theme === "light") {
                  newTheme = "dark";
                }
                setTheme(newTheme);
              }}
            />
            Switch to Dark Theme
          </label>
          <div>
          <button onClick={() => addImage('/excalidraw-poc/pika.jpeg')}>
            Add Element 1
          </button>
          </div>
          <div
            style={{
              display: "flex",
              gap: "1em",
              justifyContent: "center",
              marginTop: "1em"
            }}
          >
            <div>x: {pointerData?.pointer.x ?? 0}</div>
            <div>y: {pointerData?.pointer.y ?? 0}</div>
          </div>
        </div>
        <div className="excalidraw-wrapper">
          <Excalidraw
            ref={(api: ExcalidrawImperativeAPI) => setExcalidrawAPI(api)}
            initialData={initialStatePromiseRef.current.promise}
            onChange={(elements) => {
              console.info("Elements :", elements);
            }}
            onPointerUpdate={(payload: {
              pointer: { x: number; y: number };
              button: "down" | "up";
              pointersMap: Gesture["pointers"];
            }) => setPointerData(payload)}
            viewModeEnabled={viewModeEnabled}
            zenModeEnabled={zenModeEnabled}
            gridModeEnabled={gridModeEnabled}
            theme={theme}
            name="Custom name of drawing"
            UIOptions={{ canvasActions: { loadScene: false } }}
            onPointerDown={onPointerDown}
          >
            {excalidrawAPI && (
              <Footer>
                <CustomFooter excalidrawAPI={excalidrawAPI} />
              </Footer>
            )}
            {renderMenu()}
          </Excalidraw>

        </div>
      </ExampleSidebar>
    </div>
  );
}
