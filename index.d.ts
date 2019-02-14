
export * from './config';

/// <reference types="mmir-lib" />
import { ASROptions , MediaManager , ASROnStatus, ASROnError, MediaEventType , MediaEventHandler } from 'mmir-lib';

export type EncoderType = 'amr' | 'flac' | 'speex' | 'wav';

export interface ASREncoderOptions extends ASROptions {
  //NOT SUPPORTED via options, must be set via configuration!
  // /**
  //  * the audio-encoder for converting "raw" PCM audio (from microphone)
  //  *
  //  * encoder: ["wav" | "flac" | "amr" | <encoder module ID | module-file>]
  //  */
  // encoder?: EncoderType | string;
}

export type AudioStartedEventType = 'webaudioinputstarted';

export interface MediaManagerWebInput extends MediaManager {
  recognize: (options?: ASREncoderOptions, statusCallback?: ASROnStatus, failureCallback?: ASROnError, isIntermediateResults?: boolean) => void;
  startRecord: (options?: ASREncoderOptions, successCallback?: ASROnStatus, failureCallback?: ASROnError, intermediateResults?: boolean) => void;
  stopRecord: (options?: ASREncoderOptions, successCallback?: ASROnStatus, failureCallback?: ASROnError) => void;

  addListener: (eventName: AudioStartedEventType | MediaEventType, eventHandler: MediaEventHandler) => void;
  hasListeners: (eventName: AudioStartedEventType | MediaEventType) => boolean;
  getListeners: (eventName: AudioStartedEventType | MediaEventType) => MediaEventHandler | void;
  removeListener: (eventName: AudioStartedEventType | MediaEventType, eventHandler: MediaEventHandler) => boolean;
  off: (eventName: AudioStartedEventType | MediaEventType, eventHandler: MediaEventHandler) => boolean;
  on: (eventName: AudioStartedEventType | MediaEventType, eventHandler: MediaEventHandler) => void;

  _fireEvent: (eventName: AudioStartedEventType | MediaEventType, args: any[]) => void;

  _addListenerObserver: (eventName: AudioStartedEventType | MediaEventType, observerCallback: (actionType: "added" | "removed", eventHandler: MediaEventHandler) => void) => void;
  _removeListenerObserver: (eventName: AudioStartedEventType | MediaEventType, observerCallback: (actionType: "added" | "removed", eventHandler: MediaEventHandler) => void) => void;
  _notifyObservers: (eventName: AudioStartedEventType | MediaEventType, actionType: "added" | "removed", eventHandler: MediaEventHandler) => void;
}
