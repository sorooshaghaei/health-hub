import { useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import Dialog from "./Dialog.jsx";
import {
  fetchPatientAttachmentContent,
  uploadPatientAttachment,
} from "./patientAttachmentApi.js";
import {
  PATIENT_ATTACHMENT_ACCEPT,
  PATIENT_ATTACHMENT_MAX_BATCH,
  attachmentTypeLabel,
  attachmentUploaderLabel,
  formatAttachmentDate,
  formatAttachmentSize,
  validatePatientAttachmentFile,
} from "./patientAttachmentFiles.js";
import { ErrorMessage } from "./ui.jsx";

let queueSequence = 0;

function queueId() {
  queueSequence += 1;
  return globalThis.crypto?.randomUUID?.() ?? `attachment-${Date.now()}-${queueSequence}`;
}

function asError(error, fallback) {
  return error instanceof ApiError ? error : new ApiError(fallback);
}

function UploadQueueItem({ item, onDocumentNameChange, onRemove, onRetry, retryDisabled }) {
  const uploading = item.status === "uploading";
  const failed = item.status === "error";
  const complete = item.status === "uploaded";
  const status = uploading
    ? `${item.progress}% uploaded`
    : failed
      ? item.error
      : complete
        ? `Uploaded as ${item.attachment.document_name}`
        : "Waiting to upload";

  return (
    <li className={`attachment-upload-item attachment-upload-item--${item.status}`}>
      <div className="attachment-upload-item__heading">
        <div>
          <strong title={item.file.name}>{item.file.name}</strong>
          <span>{formatAttachmentSize(item.file.size)}</span>
        </div>
        <span className="attachment-upload-item__status">{complete ? "Uploaded" : failed ? "Failed" : uploading ? "Uploading" : "Queued"}</span>
      </div>
      {(uploading || item.status === "queued") && (
        <progress aria-label={`Upload progress for ${item.file.name}`} max="100" value={item.progress} />
      )}
      {failed && (
        <label className="attachment-upload-item__rename">
          <span>Document name for retry</span>
          <input
            type="text"
            value={item.documentName}
            onChange={(event) => onDocumentNameChange(item.id, event.target.value)}
          />
        </label>
      )}
      <p className={failed ? "attachment-upload-item__error" : "attachment-upload-item__message"} role={failed ? "alert" : complete ? "status" : undefined}>{status}</p>
      {(failed || complete) && (
        <div className="attachment-upload-item__actions">
          {failed && <button className="secondary-button" type="button" disabled={retryDisabled} aria-label={`Retry upload of ${item.file.name}`} onClick={() => onRetry(item)}>Retry</button>}
          <button className="text-button" type="button" aria-label={`${complete ? "Dismiss" : "Remove"} upload entry for ${item.file.name}`} onClick={() => onRemove(item.id)}>{complete ? "Dismiss" : "Remove"}</button>
        </div>
      )}
    </li>
  );
}

function AttachmentRow({ attachment, downloading, onDelete, onDownload, onPreview, onRename }) {
  const type = attachmentTypeLabel(attachment.content_type, attachment.document_name);
  const uploader = attachmentUploaderLabel(attachment.uploader_identity);
  return (
    <li className="attachment-row">
      <span className="attachment-row__type" aria-hidden="true">{type}</span>
      <div className="attachment-row__identity">
        <strong title={attachment.document_name}>{attachment.document_name}</strong>
        <span title={attachment.original_filename}>Original: {attachment.original_filename}</span>
        <small>{type} · {formatAttachmentSize(attachment.size)}</small>
      </div>
      <div className="attachment-row__meta">
        <span>{formatAttachmentDate(attachment.created_at)}</span>
        <small>Uploaded by {uploader}</small>
      </div>
      <div className="attachment-row__actions">
        <button
          id={`preview-attachment-${attachment.id}`}
          className="secondary-button"
          type="button"
          aria-label={`Preview ${attachment.document_name}`}
          onClick={() => onPreview(attachment)}
        >Preview</button>
        <button
          className="secondary-button"
          type="button"
          disabled={downloading}
          aria-label={`Download ${attachment.document_name}`}
          onClick={() => onDownload(attachment)}
        >{downloading ? "Downloading…" : "Download"}</button>
        <button
          id={`rename-attachment-${attachment.id}`}
          className="text-button"
          type="button"
          aria-label={`Rename ${attachment.document_name}`}
          onClick={() => onRename(attachment)}
        >Rename</button>
        <button
          id={`delete-attachment-${attachment.id}`}
          className="text-button text-button--danger"
          type="button"
          aria-label={`Delete ${attachment.document_name}`}
          onClick={() => onDelete(attachment)}
        >Delete</button>
      </div>
    </li>
  );
}

export default function PatientAttachments({
  patientId,
  patientName,
  staffToken,
  onRegisterUndo,
  refreshVersion = 0,
}) {
  const [attachments, setAttachments] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [listRevision, setListRevision] = useState(0);
  const [uploadItems, setUploadItems] = useState([]);
  const [selectionError, setSelectionError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewState, setPreviewState] = useState({ loading: false, error: null, url: null });
  const [downloadingIds, setDownloadingIds] = useState(() => new Set());
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const listRequest = useRef(0);
  const previewRequest = useRef(0);
  const previewUrl = useRef(null);
  const uploadInProgress = uploadItems.some((item) => item.status === "queued" || item.status === "uploading");

  useEffect(() => {
    const requestId = ++listRequest.current;
    const delay = search.trim() ? 220 : 0;
    setLoading(true);
    setLoadError(null);
    const timer = globalThis.setTimeout(async () => {
      const query = new URLSearchParams({ page: String(page) });
      if (search.trim()) query.set("search", search.trim());
      try {
        const payload = await apiRequest(
          `/api/patients/${patientId}/attachments/?${query.toString()}`,
          { staffToken },
        );
        if (listRequest.current !== requestId) return;
        setAttachments(payload.results);
        setCount(payload.count);
        setTotalPages(payload.total_pages);
      } catch (error) {
        if (listRequest.current === requestId) {
          setLoadError(asError(error, "Attachments could not be loaded."));
        }
      } finally {
        if (listRequest.current === requestId) setLoading(false);
      }
    }, delay);
    return () => globalThis.clearTimeout(timer);
  }, [listRevision, page, patientId, refreshVersion, search, staffToken]);

  useEffect(() => () => {
    previewRequest.current += 1;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
  }, []);

  function updateUploadItem(id, changes) {
    setUploadItems((items) => items.map((item) => (
      item.id === id ? { ...item, ...changes } : item
    )));
  }

  async function uploadOne(item) {
    const validationError = validatePatientAttachmentFile(item.file);
    if (validationError) {
      updateUploadItem(item.id, { status: "error", progress: 0, error: validationError });
      return false;
    }
    updateUploadItem(item.id, { status: "uploading", progress: 0, error: null });
    try {
      const attachment = await uploadPatientAttachment({
        patientId,
        file: item.file,
        documentName: item.documentName,
        staffToken,
        onProgress: (progress) => updateUploadItem(item.id, { progress }),
      });
      updateUploadItem(item.id, {
        attachment,
        documentName: attachment.document_name,
        error: null,
        progress: 100,
        status: "uploaded",
      });
      return true;
    } catch (error) {
      const uploadError = asError(error, `${item.file.name} could not be uploaded.`);
      updateUploadItem(item.id, {
        status: "error",
        progress: 0,
        error: uploadError.message,
      });
      return false;
    }
  }

  async function runUploadBatch(entries) {
    let nextIndex = 0;
    let uploaded = false;
    async function worker() {
      while (nextIndex < entries.length) {
        const entry = entries[nextIndex];
        nextIndex += 1;
        if (await uploadOne(entry)) uploaded = true;
      }
    }
    await Promise.all(Array.from({ length: Math.min(2, entries.length) }, worker));
    if (uploaded) {
      setPage(1);
      setListRevision((version) => version + 1);
    }
  }

  function selectFiles(fileList) {
    const files = [...(fileList ?? [])];
    setSelectionError(null);
    if (!files.length) return;
    if (uploadInProgress) {
      setSelectionError(new ApiError("Wait for the current files to finish uploading."));
      return;
    }
    if (files.length > PATIENT_ATTACHMENT_MAX_BATCH) {
      setSelectionError(new ApiError("Choose no more than 10 files at once."));
      return;
    }
    const entries = files.map((file) => {
      const error = validatePatientAttachmentFile(file);
      return {
        id: queueId(),
        file,
        documentName: file.name,
        status: error ? "error" : "queued",
        progress: 0,
        error,
        attachment: null,
      };
    });
    setUploadItems((items) => [...items, ...entries]);
    const validEntries = entries.filter((item) => !item.error);
    if (validEntries.length) void runUploadBatch(validEntries);
  }

  function handleInput(event) {
    selectFiles(event.target.files);
    event.target.value = "";
  }

  function handleDragEnter(event) {
    if (![...(event.dataTransfer?.types ?? [])].includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragActive(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    selectFiles(event.dataTransfer.files);
  }

  async function retryUpload(item) {
    if (uploadInProgress) return;
    const uploaded = await uploadOne(item);
    if (uploaded) {
      setPage(1);
      setListRevision((version) => version + 1);
    }
  }

  function openRename(attachment) {
    setRenameTarget(attachment);
    setRenameValue(attachment.document_name);
    setRenameError(null);
  }

  function closeRename() {
    if (renameBusy) return;
    setRenameTarget(null);
    setRenameError(null);
  }

  async function submitRename(event) {
    event.preventDefault();
    if (!renameTarget || renameBusy) return;
    setRenameBusy(true);
    setRenameError(null);
    try {
      const renamed = await apiRequest(
        `/api/patients/${patientId}/attachments/${renameTarget.id}/`,
        { method: "PATCH", data: { document_name: renameValue }, staffToken },
      );
      setAttachments((items) => items.map((item) => item.id === renamed.id ? renamed : item));
      setRenameTarget(null);
      setListRevision((version) => version + 1);
    } catch (error) {
      setRenameError(asError(error, "The document could not be renamed."));
    } finally {
      setRenameBusy(false);
    }
  }

  function openDelete(attachment) {
    setDeleteTarget(attachment);
    setDeleteError(null);
  }

  function closeDelete() {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const deleted = await apiRequest(
        `/api/patients/${patientId}/attachments/${deleteTarget.id}/`,
        { method: "DELETE", staffToken },
      );
      onRegisterUndo?.({
        id: `attachment-delete:${deleteTarget.id}:${Date.now()}`,
        kind: "attachment_delete",
        resourceId: deleteTarget.id,
        patientId,
        message: `${deleteTarget.document_name} deleted.`,
        undoUntil: deleted.undo_until,
      });
      setAttachments((items) => items.filter((item) => item.id !== deleteTarget.id));
      setCount((value) => Math.max(0, value - 1));
      setDeleteTarget(null);
      if (attachments.length === 1 && page > 1) setPage((value) => value - 1);
      else setListRevision((version) => version + 1);
    } catch (error) {
      setDeleteError(asError(error, "The document could not be deleted."));
    } finally {
      setDeleteBusy(false);
    }
  }

  function closePreview() {
    previewRequest.current += 1;
    if (previewUrl.current) {
      URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = null;
    }
    setPreviewTarget(null);
    setPreviewState({ loading: false, error: null, url: null });
  }

  async function openPreview(attachment) {
    const requestId = ++previewRequest.current;
    setPreviewTarget(attachment);
    setPreviewState({ loading: true, error: null, url: null });
    try {
      const blob = await fetchPatientAttachmentContent(attachment.preview_path, staffToken);
      if (previewRequest.current !== requestId) return;
      const url = URL.createObjectURL(blob);
      previewUrl.current = url;
      setPreviewState({ loading: false, error: null, url });
    } catch (error) {
      if (previewRequest.current === requestId) {
        setPreviewState({
          loading: false,
          error: asError(error, "The document preview could not be loaded."),
          url: null,
        });
      }
    }
  }

  async function downloadAttachment(attachment) {
    setActionError(null);
    setDownloadingIds((ids) => new Set(ids).add(attachment.id));
    try {
      const blob = await fetchPatientAttachmentContent(attachment.download_path, staffToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.document_name;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setActionError(asError(error, "The document could not be downloaded."));
    } finally {
      setDownloadingIds((ids) => {
        const next = new Set(ids);
        next.delete(attachment.id);
        return next;
      });
    }
  }

  return (
    <section className="patient-attachments" aria-labelledby="patient-attachments-title">
      <div className="patient-attachments__heading">
        <div>
          <p className="eyebrow">Patient documents</p>
          <h3 id="patient-attachments-title">Attachments</h3>
        </div>
        <div className="patient-attachments__heading-actions">
          <span className="patient-attachments__count">{count} document{count === 1 ? "" : "s"}</span>
          <button
            id="attachment-add-files"
            className="secondary-button"
            type="button"
            disabled={uploadInProgress}
            aria-describedby="attachment-upload-limits"
            onClick={() => inputRef.current?.click()}
          >Add files</button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            multiple
            accept={PATIENT_ATTACHMENT_ACCEPT}
            tabIndex={-1}
            aria-label={`Add attachments for ${patientName}`}
            aria-describedby="attachment-upload-limits"
            onChange={handleInput}
          />
        </div>
      </div>

      <p id="attachment-upload-limits" className="patient-attachments__limits">PDF, JPG, JPEG, PNG, HEIC, or HEIF · up to 100 MB per file · up to 10 files at once</p>

      <div
        className={`attachment-drop-zone${dragActive ? " attachment-drop-zone--active" : ""}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      >
        <strong className="attachment-drop-zone__desktop">Drop files here</strong>
        <strong className="attachment-drop-zone__mobile">Use Add files to choose documents</strong>
        <span>Files begin uploading after selection. Failed files can be renamed and retried or removed.</span>
      </div>

      <ErrorMessage error={selectionError} />
      {uploadItems.length > 0 && (
        <section className="attachment-upload-queue" aria-labelledby="attachment-upload-queue-title">
          <div className="attachment-upload-queue__heading">
            <h4 id="attachment-upload-queue-title">Uploads</h4>
            <span>{uploadItems.length}</span>
          </div>
          <ul>
            {uploadItems.map((item) => (
              <UploadQueueItem
                item={item}
                key={item.id}
                onDocumentNameChange={(id, documentName) => updateUploadItem(id, { documentName })}
                onRemove={(id) => setUploadItems((items) => items.filter((entry) => entry.id !== id))}
                onRetry={retryUpload}
                retryDisabled={uploadInProgress}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="attachment-list-toolbar">
        <label className="attachment-search" htmlFor="attachment-search-input">
          <span>Search documents</span>
          <input
            id="attachment-search-input"
            type="search"
            value={search}
            placeholder="Search document names"
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          />
        </label>
        {search && <button className="text-button" type="button" onClick={() => { setSearch(""); setPage(1); }}>Clear search</button>}
      </div>

      <ErrorMessage error={actionError} />
      {loadError ? (
        <div className="attachment-list-error">
          <ErrorMessage error={loadError} focus />
          <button className="secondary-button" type="button" onClick={() => setListRevision((version) => version + 1)}>Try again</button>
        </div>
      ) : loading ? (
        <div className="attachment-loading" role="status" aria-label="Loading attachments"><div className="loader" aria-hidden="true" /></div>
      ) : attachments.length ? (
        <ul className="attachment-list">
          {attachments.map((attachment) => (
            <AttachmentRow
              attachment={attachment}
              downloading={downloadingIds.has(attachment.id)}
              key={attachment.id}
              onDelete={openDelete}
              onDownload={downloadAttachment}
              onPreview={openPreview}
              onRename={openRename}
            />
          ))}
        </ul>
      ) : (
        <div className="attachment-empty">
          <strong>{search.trim() ? "No matching documents" : "No attachments yet"}</strong>
          <span>{search.trim() ? "No current document names match this search." : "Add PDFs or images to keep Patient documents with this profile."}</span>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="attachment-pagination" aria-label="Attachment pages">
          <button className="secondary-button" type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="secondary-button" type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button>
        </nav>
      )}

      {renameTarget && (
        <Dialog
          className="device-modal attachment-rename-dialog"
          ariaLabelledBy="attachment-rename-title"
          ariaDescribedBy="attachment-rename-description"
          canClose={!renameBusy}
          returnFocusSelector={`#rename-attachment-${renameTarget.id}, #attachment-add-files`}
          onClose={closeRename}
        >
          <div className="device-modal__header">
            <div>
              <p className="eyebrow">Patient document</p>
              <h2 id="attachment-rename-title">Rename document</h2>
              <p id="attachment-rename-description">Change the displayed and downloaded name. The file type and original filename stay unchanged.</p>
            </div>
            <button className="device-icon-button" type="button" disabled={renameBusy} onClick={closeRename} aria-label={`Close rename for ${renameTarget.document_name}`}>×</button>
          </div>
          <ErrorMessage error={renameError} focus />
          <form onSubmit={submitRename}>
            <label className="field">
              <span>Document name</span>
              <input data-dialog-initial-focus="true" type="text" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
              <small>Keep the current file extension, or omit it and Health Hub will add it.</small>
            </label>
            <div className="form-actions">
              <button className="secondary-button" type="button" disabled={renameBusy} onClick={closeRename}>Cancel</button>
              <button className="primary-button primary-button--compact" type="submit" disabled={renameBusy || !renameValue.trim()}>{renameBusy ? "Saving…" : "Save name"}</button>
            </div>
          </form>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog
          className="device-modal attachment-delete-dialog"
          role="alertdialog"
          ariaLabelledBy="attachment-delete-title"
          ariaDescribedBy="attachment-delete-description"
          canClose={!deleteBusy}
          returnFocusSelector={`#delete-attachment-${deleteTarget.id}, #attachment-add-files`}
          onClose={closeDelete}
        >
          <div className="device-modal__header">
            <div>
              <p className="eyebrow">Patient document</p>
              <h2 id="attachment-delete-title">Delete {deleteTarget.document_name}?</h2>
              <p id="attachment-delete-description">The document will disappear immediately. You can Undo the deletion for five seconds.</p>
            </div>
            <button className="device-icon-button" type="button" disabled={deleteBusy} onClick={closeDelete} aria-label={`Close deletion confirmation for ${deleteTarget.document_name}`}>×</button>
          </div>
          <ErrorMessage error={deleteError} focus />
          <p className="attachment-delete-dialog__warning">After the Undo period, both the document record and stored file are permanently deleted.</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" disabled={deleteBusy} data-dialog-initial-focus="true" onClick={closeDelete}>Cancel</button>
            <button className="danger-button" type="button" disabled={deleteBusy} onClick={confirmDelete}>{deleteBusy ? "Deleting…" : `Delete ${deleteTarget.document_name}`}</button>
          </div>
        </Dialog>
      )}

      {previewTarget && (
        <Dialog
          className="device-modal attachment-preview-dialog"
          ariaLabelledBy="attachment-preview-title"
          canClose
          returnFocusSelector={`#preview-attachment-${previewTarget.id}, #attachment-add-files`}
          onClose={closePreview}
        >
          <div className="device-modal__header">
            <div>
              <p className="eyebrow">Document preview</p>
              <h2 id="attachment-preview-title">{previewTarget.document_name}</h2>
            </div>
            <button className="device-icon-button" type="button" data-dialog-initial-focus="true" onClick={closePreview} aria-label={`Close preview of ${previewTarget.document_name}`}>×</button>
          </div>
          {previewState.loading ? (
            <div className="attachment-preview__loading" role="status" aria-label={`Loading preview of ${previewTarget.document_name}`}><div className="loader" aria-hidden="true" /></div>
          ) : previewState.error ? (
            <ErrorMessage error={previewState.error} focus />
          ) : previewState.url && previewTarget.content_type === "application/pdf" ? (
            <iframe className="attachment-preview__frame" src={previewState.url} sandbox="" title={`Preview of ${previewTarget.document_name}`} />
          ) : previewState.url ? (
            <div className="attachment-preview__image-wrap"><img src={previewState.url} alt={`Preview of ${previewTarget.document_name}`} /></div>
          ) : null}
        </Dialog>
      )}
    </section>
  );
}
