import PatientWorkspaceView from "./PatientWorkspaceView.jsx";
import usePatientWorkspace from "./usePatientWorkspace.js";

export default function Workspace(props) {
  const controller = usePatientWorkspace({ user: props.user, staffToken: props.staffToken });
  return <PatientWorkspaceView {...props} controller={controller} />;
}
