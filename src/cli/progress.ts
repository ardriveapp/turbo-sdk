/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import cliProgress from 'cli-progress';

import { TurboFolderUploadEventsAndPayloads } from '../types.js';

/**
 * Formats bytes to human-readable format (KB, MB, GB)
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Progress bar manager for folder uploads in CLI
 */
export class FolderUploadProgress {
  private multibar?: cliProgress.MultiBar;
  private folderBar?: cliProgress.SingleBar;
  private fileBar?: cliProgress.SingleBar;
  private enabled: boolean;
  private isTTY: boolean;
  private totalFiles: number = 0;
  private totalBytes: number = 0;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.isTTY = process.stdout.isTTY ?? false;

    // Only create progress bars if enabled and we have a TTY
    if (this.enabled && this.isTTY) {
      this.multibar = new cliProgress.MultiBar(
        {
          clearOnComplete: false,
          hideCursor: true,
          format: '{bar} | {percentage}% | {status}',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          stopOnComplete: true,
        },
        cliProgress.Presets.shades_classic,
      );
    }
  }

  /**
   * Handle file upload start event
   */
  onFileStart(
    event: TurboFolderUploadEventsAndPayloads['file-upload-start'],
  ): void {
    const { fileName, fileSize, fileIndex, totalFiles } = event;

    if (!this.enabled || !this.isTTY || !this.multibar) {
      // Fallback to simple console output
      if (this.enabled) {
        console.log(
          `[${fileIndex + 1}/${totalFiles}] Uploading: ${fileName} (${formatBytes(fileSize)})`,
        );
      }
      return;
    }

    // Create or update file progress bar
    if (!this.fileBar) {
      this.fileBar = this.multibar.create(fileSize, 0, {
        status: `File: ${fileName}`,
      });
    } else {
      this.fileBar.setTotal(fileSize);
      this.fileBar.update(0, {
        status: `File: ${fileName}`,
      });
    }
  }

  /**
   * Handle file upload progress event
   */
  onFileProgress(
    event: TurboFolderUploadEventsAndPayloads['file-upload-progress'],
  ): void {
    const { fileProcessedBytes } = event;

    if (!this.enabled || !this.isTTY || !this.fileBar) {
      return;
    }

    this.fileBar.update(fileProcessedBytes);
  }

  /**
   * Handle file upload complete event
   */
  onFileComplete(
    event: TurboFolderUploadEventsAndPayloads['file-upload-complete'],
  ): void {
    const { fileName, fileIndex, totalFiles } = event;

    if (!this.enabled || !this.isTTY || !this.fileBar) {
      // Fallback to simple console output
      if (this.enabled) {
        console.log(`✓ [${fileIndex + 1}/${totalFiles}] Completed: ${fileName}`);
      }
      return;
    }

    // Get the current total and complete the file bar
    const currentTotal = this.fileBar.getTotal();
    this.fileBar.update(currentTotal, {
      status: `✓ ${fileName}`,
    });
  }

  /**
   * Handle file upload error event
   */
  onFileError(
    event: TurboFolderUploadEventsAndPayloads['file-upload-error'],
  ): void {
    const { fileName, error } = event;

    if (!this.enabled || !this.isTTY) {
      if (this.enabled) {
        console.error(`✗ Failed: ${fileName} - ${error.message}`);
      }
      return;
    }

    // Stop the file bar and show error
    if (this.fileBar) {
      this.fileBar.stop();
    }
    console.error(`✗ Failed: ${fileName} - ${error.message}`);
  }

  /**
   * Handle folder progress event
   */
  onFolderProgress(
    event: TurboFolderUploadEventsAndPayloads['folder-progress'],
  ): void {
    const { processedFiles, totalFiles, processedBytes, totalBytes } = event;

    this.totalFiles = totalFiles;
    this.totalBytes = totalBytes;

    if (!this.enabled || !this.isTTY || !this.multibar) {
      return;
    }

    // Create folder progress bar on first call
    if (!this.folderBar) {
      this.folderBar = this.multibar.create(totalFiles, processedFiles, {
        status: `Overall: ${processedFiles}/${totalFiles} files (${formatBytes(processedBytes)}/${formatBytes(totalBytes)})`,
      });
    } else {
      this.folderBar.update(processedFiles, {
        status: `Overall: ${processedFiles}/${totalFiles} files (${formatBytes(processedBytes)}/${formatBytes(totalBytes)})`,
      });
    }
  }

  /**
   * Handle folder error event
   */
  onFolderError(error: TurboFolderUploadEventsAndPayloads['folder-error']): void {
    if (!this.enabled) {
      return;
    }

    this.stop();
    console.error(`\n✗ Folder upload failed: ${error.message}`);
  }

  /**
   * Handle folder success event
   */
  onFolderSuccess(): void {
    if (!this.enabled || !this.isTTY) {
      if (this.enabled) {
        console.log(
          `\n✓ Folder upload complete! (${this.totalFiles} files, ${formatBytes(this.totalBytes)})`,
        );
      }
      return;
    }

    // Complete all progress bars
    if (this.folderBar) {
      this.folderBar.update(this.totalFiles, {
        status: `✓ Complete: ${this.totalFiles} files (${formatBytes(this.totalBytes)})`,
      });
    }
  }

  /**
   * Stop and clean up progress bars
   */
  stop(): void {
    if (this.multibar) {
      this.multibar.stop();
    }
  }
}

/**
 * Progress bar manager for file uploads in CLI
 */
export class FileUploadProgress {
  private bar?: cliProgress.SingleBar;
  private enabled: boolean;
  private isTTY: boolean;
  private totalBytes: number = 0;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
    this.isTTY = process.stdout.isTTY ?? false;
  }

  /**
   * Initialize progress bar with total size
   */
  start(totalBytes: number, fileName?: string): void {
    this.totalBytes = totalBytes;

    if (!this.enabled || !this.isTTY) {
      if (this.enabled && fileName) {
        console.log(`Uploading: ${fileName} (${formatBytes(totalBytes)})`);
      }
      return;
    }

    this.bar = new cliProgress.SingleBar(
      {
        format: '{bar} | {percentage}% | {status}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic,
    );

    this.bar.start(totalBytes, 0, {
      status: fileName
        ? `Uploading: ${fileName} (${formatBytes(totalBytes)})`
        : `Uploading (${formatBytes(totalBytes)})`,
    });
  }

  /**
   * Update progress
   */
  update(processedBytes: number): void {
    if (!this.enabled || !this.isTTY || !this.bar) {
      return;
    }

    this.bar.update(processedBytes, {
      status: `${formatBytes(processedBytes)}/${formatBytes(this.totalBytes)}`,
    });
  }

  /**
   * Mark as complete
   */
  complete(): void {
    if (!this.enabled || !this.isTTY || !this.bar) {
      if (this.enabled) {
        console.log(`✓ Upload complete (${formatBytes(this.totalBytes)})`);
      }
      return;
    }

    this.bar.update(this.totalBytes, {
      status: `✓ Complete (${formatBytes(this.totalBytes)})`,
    });
    this.bar.stop();
  }

  /**
   * Handle error
   */
  error(error: Error): void {
    if (this.bar) {
      this.bar.stop();
    }
    if (this.enabled) {
      console.error(`✗ Upload failed: ${error.message}`);
    }
  }

  /**
   * Stop progress bar
   */
  stop(): void {
    if (this.bar) {
      this.bar.stop();
    }
  }
}
