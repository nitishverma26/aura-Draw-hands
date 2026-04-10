import { useEffect, useRef, useState, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { GestureType, Point, HandState } from '../types';

const DEFAULT_HAND_STATE: HandState = {
  isActive: false,
  gesture: 'NONE',
  position: { x: 0, y: 0 },
  rawLandmarks: [],
};

export function useHandTracking(videoElement: HTMLVideoElement | null) {
  const [rightHand, setRightHand] = useState<HandState>(DEFAULT_HAND_STATE);
  const [leftHand, setLeftHand] = useState<HandState>(DEFAULT_HAND_STATE);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  // Helper to calculate distance between two points
  const getDistance = (p1: any, p2: any) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  // Simple gesture recognition
  const recognizeGesture = (landmarks: any[], label: string): GestureType => {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const indexPip = landmarks[6];
    const middleTip = landmarks[12];
    const middlePip = landmarks[10];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    const wrist = landmarks[0];

    const isIndexUp = indexTip.y < indexPip.y;
    const isMiddleUp = middleTip.y < middlePip.y;
    const isRingUp = ringTip.y < landmarks[14].y;
    const isPinkyUp = pinkyTip.y < landmarks[18].y;
    
    const pinchDist = getDistance(thumbTip, indexTip);
    const isPinching = pinchDist < 0.05;

    // Fist detection (all tips close to wrist/palm)
    const isFist = [indexTip, middleTip, ringTip, pinkyTip].every(tip => getDistance(tip, wrist) < 0.15);

    if (label === 'Right') {
      if (isFist) return 'CLEAR';
      if (isPinching) return 'ERASE';
      if (isIndexUp && !isMiddleUp) return 'DRAW';
    } else {
      // Left Hand
      if (isIndexUp && isMiddleUp && isRingUp && isPinkyUp) return 'ROTATE'; // Open Palm
      if (isIndexUp && isMiddleUp && !isRingUp) return 'MOVE'; // Two fingers
      if (isPinching) return 'SCALE';
    }

    return 'NONE';
  };

  const onResults = useCallback((results: Results) => {
    let newRight: HandState = { ...DEFAULT_HAND_STATE };
    let newLeft: HandState = { ...DEFAULT_HAND_STATE };

    if (results.multiHandLandmarks && results.multiHandedness) {
      results.multiHandLandmarks.forEach((landmarks, index) => {
        const handedness = results.multiHandedness[index];
        const label = handedness.label; 
        
        // MediaPipe 'Left' is user's right hand when mirrored
        const isUserRight = label === 'Left';
        
        const gesture = recognizeGesture(landmarks, isUserRight ? 'Right' : 'Left');
        const position = { x: 1 - landmarks[8].x, y: landmarks[8].y }; // Mirror X coordinate for UI

        const state: HandState = {
          isActive: true,
          gesture,
          position,
          rawLandmarks: landmarks,
        };

        if (isUserRight) newRight = state;
        else newLeft = state;
      });
    }

    setRightHand(newRight);
    setLeftHand(newLeft);
  }, []);

  useEffect(() => {
    if (!videoElement) return;

    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        await hands.send({ image: videoElement });
      },
      width: 1280,
      height: 720,
    });

    camera.start();
    cameraRef.current = camera;

    return () => {
      camera.stop();
      hands.close();
    };
  }, [videoElement, onResults]);

  return { rightHand, leftHand };
}
