import fs from "fs";
import path, { resolve } from "path";

import React from "react";
import { action, reaction, observable, runInAction } from "mobx";
import { observer } from "mobx-react";

import { getHomePath, isDev } from "eez-studio-shared/util-electron";
import { sourceRootDir } from "eez-studio-shared/util";

import { BootstrapDialog, showDialog } from "eez-studio-ui/dialog";
import { List, IListNode, ListItem } from "eez-studio-ui/list";
import { Loader } from "eez-studio-ui/loader";

class NameInput extends React.Component<{
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    render() {
        return (
            <input
                type="text"
                className="form-control"
                value={this.props.value || ""}
                onChange={event => this.props.onChange(event.target.value)}
                spellCheck={false}
            />
        );
    }
}

class DirectoryBrowserInput extends React.Component<{
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    onSelect = async () => {
        const result = await EEZStudio.remote.dialog.showOpenDialog({
            properties: ["openDirectory"]
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(result.filePaths[0]);
        }
    };

    render() {
        return (
            <div className="input-group">
                <input
                    type="text"
                    className="form-control"
                    value={this.props.value || ""}
                    onChange={event => this.props.onChange(event.target.value)}
                    spellCheck={false}
                />
                <>
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect}
                    >
                        Browse...
                    </button>
                </>
            </div>
        );
    }
}

class FileBrowserInput extends React.Component<{
    value: string | undefined;
    onChange: (value: string | undefined) => void;
}> {
    onSelect = async () => {
        const result = await EEZStudio.remote.dialog.showOpenDialog({
            properties: ["openFile"],
            filters: [
                { name: "EEZ Project", extensions: ["eez-project"] },
                { name: "All Files", extensions: ["*"] }
            ]
        });

        if (result.filePaths && result.filePaths[0]) {
            this.props.onChange(result.filePaths[0]);
        }
    };

    render() {
        return (
            <div className="input-group">
                <input
                    type="text"
                    className="form-control"
                    value={this.props.value || ""}
                    onChange={event => this.props.onChange(event.target.value)}
                    spellCheck={false}
                />
                <>
                    <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={this.onSelect}
                    >
                        Browse...
                    </button>
                </>
            </div>
        );
    }
}

const RESOURCE_PROJECT_NAME = "MicroPython resource";

@observer
class NewProjectWizard extends React.Component {
    @observable open = true;

    @observable disableButtons: boolean = false;

    @observable step: number = 0;

    @observable type: string = "dashboard";

    @observable name: string | undefined;
    @observable nameError: string | undefined;

    @observable location: string | undefined = getHomePath("eez-projects");
    @observable locationError: string | undefined;

    @observable createDirectory: boolean = false;

    @observable bb3ProjectOption: "download" | "local" = "download";
    @observable bb3ProjectFileDownloadError: string | undefined;
    @observable bb3ProjectFile: string | undefined;
    @observable bb3ProjectFileError: string | undefined;

    @observable projectVersion: string = "v3";

    constructor(props: any) {
        super(props);

        const optionsJSON = window.localStorage.getItem("project-wizard");
        if (optionsJSON) {
            try {
                const options = JSON.parse(optionsJSON);
                if (options.version == 1) {
                    this.type = options.type;
                    this.location = options.location;
                    this.createDirectory = options.createDirectory;
                    this.bb3ProjectOption = options.bb3ProjectOption;
                    this.bb3ProjectFile = options.bb3ProjectFile;
                    this.projectVersion = options.projectVersion;
                }
            } catch (err) {
                console.error(err);
            }
        }

        reaction(
            () => ({
                name: this.name,
                location: this.location,
                bb3ProjectFile: this.bb3ProjectFile
            }),
            () => {
                if (this.nameError) {
                    this.validateName();
                }
                if (this.locationError) {
                    this.validateLocation();
                }
                if (this.bb3ProjectFileError) {
                    this.validateBB3ProjectFile();
                }
            }
        );
    }

    saveOptions() {
        window.localStorage.setItem(
            "project-wizard",
            JSON.stringify({
                version: 1,
                type: this.type,
                location: this.location,
                createDirectory: this.createDirectory,
                bb3ProjectOption: this.bb3ProjectOption,
                bb3ProjectFile: this.bb3ProjectFile,
                projectVersion: this.projectVersion
            })
        );
    }

    get numSteps() {
        if (this.type == "applet") {
            return 2;
        }
        if (this.type == "resource") {
            return 3;
        }
        return 1;
    }

    get projectTypes(): IListNode[] {
        return [
            {
                id: "dashboard",
                label: "Dashboard",
                selected: this.type === "dashboard",
                data: undefined
            },
            {
                id: "applet",
                label: "Applet",
                selected: this.type === "applet",
                data: undefined
            },
            {
                id: "resource",
                label: RESOURCE_PROJECT_NAME,
                selected: this.type === "resource",
                data: undefined
            },
            {
                id: "empty",
                label: "Empty",
                selected: this.type === "empty",
                data: undefined
            }
        ];
    }

    async loadProjectTemplate() {
        const relativePath = `project-templates/${this.type}.eez-project`;

        const json = await fs.promises.readFile(
            isDev
                ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
                : `${process.resourcesPath!}/${relativePath}`,
            "utf8"
        );

        return JSON.parse(json);
    }

    get uiStateSrc() {
        const relativePath = `project-templates/${this.type}.eez-project-ui-state`;
        return isDev
            ? resolve(`${sourceRootDir()}/../resources/${relativePath}`)
            : `${process.resourcesPath!}/${relativePath}`;
    }

    get uiStateDst() {
        return `${this.projectDirPath}/${this.name}.eez-project-ui-state`;
    }

    get projectDirPath() {
        if (!this.location || !this.name) {
            return undefined;
        }
        if (this.createDirectory) {
            return `${this.location}${path.sep}${this.name}`;
        } else {
            return this.location;
        }
    }

    get projectFilePath() {
        if (!this.projectDirPath) {
            return undefined;
        }
        return `${this.projectDirPath}${path.sep}${this.name}.eez-project`;
    }

    @action
    validateName() {
        const name = this.name?.trim();
        if (!name) {
            this.nameError = "This field is required.";
            return;
        }

        this.nameError = undefined;
        return true;
    }

    @action
    validateLocation() {
        const location = this.location?.trim();
        if (!location) {
            this.locationError = "This field is required.";
            return;
        }

        if (this.projectFilePath && fs.existsSync(this.projectFilePath)) {
            this.locationError =
                "Project with the same name already exists at this location.";
            return;
        }

        this.locationError = undefined;
        return true;
    }

    @action
    validateBB3ProjectFile() {
        this.bb3ProjectFileDownloadError = undefined;

        if (this.bb3ProjectOption == "download") {
            this.bb3ProjectFileError = undefined;
            return true;
        }

        const bb3ProjectFile = this.bb3ProjectFile?.trim();
        if (!bb3ProjectFile) {
            this.bb3ProjectFileError = "This field is required.";
            return;
        }

        if (!fs.existsSync(bb3ProjectFile)) {
            this.bb3ProjectFileError = "File does not exists.";
            return;
        }

        this.bb3ProjectFileError = undefined;
        return true;
    }

    downloadBB3ProjectFile() {
        return new Promise<void>((resolve, reject) => {
            const bb3ProjectFileUrl =
                this.projectVersion == "v3"
                    ? "https://raw.githubusercontent.com/eez-open/modular-psu-firmware/master/modular-psu-firmware.eez-project"
                    : "https://raw.githubusercontent.com/eez-open/modular-psu-firmware/1.7.3/modular-psu-firmware.eez-project";

            let req = new XMLHttpRequest();
            req.responseType = "json";
            req.open("GET", bb3ProjectFileUrl);

            req.addEventListener("load", async () => {
                if (req.readyState == 4) {
                    if (req.status != 200 || !req.response) {
                        reject("Download failed!");
                        return;
                    }
                    try {
                        await fs.promises.writeFile(
                            this.projectDirPath +
                                path.sep +
                                "modular-psu-firmware.eez-project",
                            JSON.stringify(req.response, undefined, 2),
                            "utf8"
                        );

                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                }
            });

            req.addEventListener("error", error => {
                reject(error);
            });

            req.send();
        });
    }

    onOk = async () => {
        runInAction(() => (this.disableButtons = true));

        try {
            if (this.step == 0) {
                this.validateName();
                this.validateLocation();

                if (this.nameError || this.locationError) {
                    return;
                }
            } else if (this.step == 1) {
                this.validateBB3ProjectFile();

                if (this.bb3ProjectFileError) {
                    return;
                }
            }

            if (this.step + 1 < this.numSteps) {
                runInAction(() => this.step++);
                return;
            }

            try {
                await fs.promises.mkdir(this.projectDirPath!, {
                    recursive: true
                });
            } catch (err) {
                runInAction(() => {
                    this.step = 0;
                    this.locationError = err.toString();
                });
                return;
            }

            const projectFilePath = this.projectFilePath!;

            const projectTemplate = await this.loadProjectTemplate();

            // set projectVersion
            projectTemplate.settings.general.projectVersion =
                this.type == "resource" ? this.projectVersion : "v3";

            if (this.type == "applet" || this.type == "resource") {
                // set masterProject
                if (this.bb3ProjectOption == "download") {
                    try {
                        await this.downloadBB3ProjectFile();
                    } catch (err) {
                        runInAction(() => {
                            this.step = 1;
                            this.bb3ProjectFileDownloadError = err.toString();
                        });
                        return;
                    }
                    projectTemplate.settings.general.masterProject =
                        "." + path.sep + "modular-psu-firmware.eez-project";
                } else {
                    projectTemplate.settings.general.masterProject =
                        path.relative(projectFilePath, this.bb3ProjectFile!);
                }

                // set title bar text
                if (this.type == "applet") {
                    projectTemplate.pages[0].components[1].widgets[1].data = `"${this.name}"`;
                } else {
                    projectTemplate.pages[0].components[1].widgets[1].text =
                        this.name;

                    projectTemplate.micropython.code =
                        projectTemplate.micropython.code.replace(
                            "Scripts/resource.res",
                            `Scripts/${this.name}.res`
                        );
                }
            }

            try {
                await fs.promises.writeFile(
                    projectFilePath,
                    JSON.stringify(projectTemplate, undefined, 2),
                    "utf8"
                );

                fs.promises.copyFile(this.uiStateSrc, this.uiStateDst);
            } catch (err) {
                runInAction(() => {
                    this.step = 0;
                    this.nameError = err.toString();
                });
                return;
            }

            runInAction(() => (this.open = false));

            EEZStudio.electron.ipcRenderer.send("open-file", projectFilePath);

            this.open = false;

            this.saveOptions();
        } finally {
            runInAction(() => (this.disableButtons = false));
        }
    };

    onCancel = action(() => {
        if (this.step > 0) {
            this.step--;
        } else {
            this.open = false;
        }
    });

    render() {
        return (
            <BootstrapDialog
                modal={true}
                open={this.open}
                title={
                    "New Project" +
                    (this.numSteps > 1
                        ? ` - Step ${this.step + 1} of ${this.numSteps}`
                        : "")
                }
                size={"large"}
                onSubmit={this.onOk}
                onCancel={this.onCancel}
                cancelDisabled={false}
                okEnabled={() => false}
                disableButtons={this.disableButtons}
                backdrop="static"
                buttons={[
                    {
                        id: "cancel",
                        type: "secondary",
                        position: "right",
                        onClick: this.onCancel,
                        disabled: false,
                        style: {},
                        text: this.step == 0 ? "Cancel" : "Back"
                    },
                    {
                        id: "ok",
                        type: "primary",
                        position: "right",
                        onClick: this.onOk,
                        disabled: false,
                        style: {},
                        text: this.step + 1 == this.numSteps ? "OK" : "Next"
                    }
                ]}
                additionalFooterControl={this.disableButtons && <Loader />}
            >
                {this.step == 0 && (
                    <>
                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label">
                                Type
                            </label>
                            <div className="col-sm-10">
                                <List
                                    nodes={this.projectTypes}
                                    renderNode={node => {
                                        return <ListItem label={node.label} />;
                                    }}
                                    selectNode={action(
                                        node => (this.type = node.id)
                                    )}
                                    className="overflow-auto border rounded-1"
                                    style={{ width: 240 }}
                                    tabIndex={0}
                                />
                            </div>
                        </div>

                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label">
                                Name
                            </label>
                            <div className="col-sm-10">
                                <NameInput
                                    value={this.name}
                                    onChange={action(
                                        (value: string | undefined) =>
                                            (this.name = value)
                                    )}
                                />
                                {this.nameError && (
                                    <div className="text-danger">
                                        {this.nameError}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label">
                                Location
                            </label>
                            <div className="col-sm-10">
                                <DirectoryBrowserInput
                                    value={this.location}
                                    onChange={action(
                                        (value: string | undefined) =>
                                            (this.location = value)
                                    )}
                                />
                                {this.locationError && (
                                    <div className="text-danger">
                                        {this.locationError}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mb-3 row">
                            <div className="col-sm-2"></div>
                            <div className="col-sm-10">
                                <div className="form-check">
                                    <input
                                        id="new-project-wizard-create-directory-checkbox"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={this.createDirectory}
                                        onChange={action(
                                            event =>
                                                (this.createDirectory =
                                                    event.target.checked)
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-create-directory-checkbox"
                                    >
                                        Create directory
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label">
                                Project path
                            </label>
                            <div className="col-sm-10">
                                <input
                                    type="text"
                                    className="form-control"
                                    value={this.projectFilePath || ""}
                                    readOnly
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    </>
                )}

                {this.step == 1 && (
                    <>
                        <div className="mb-3 row">
                            <h6>
                                {this.type == "applet"
                                    ? "Applet"
                                    : RESOURCE_PROJECT_NAME}{" "}
                                project requires BB3 project file. We have the
                                following options:
                            </h6>
                        </div>

                        <div className="mb-1 row">
                            <label className="col-sm-2 col-form-label"></label>
                            <div className="col-sm-10 d-flex align-items-center">
                                <div className="form-check form-check-inline">
                                    <input
                                        id="new-project-wizard-bb3-project-download"
                                        className="form-check-input"
                                        type="radio"
                                        name="new-project-wizard-bb3-project"
                                        value={"download"}
                                        checked={
                                            this.bb3ProjectOption == "download"
                                        }
                                        onChange={action(
                                            event =>
                                                (this.bb3ProjectOption = event
                                                    .target.checked
                                                    ? "download"
                                                    : "local")
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-bb3-project-download"
                                    >
                                        Download from GitHub
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label"></label>
                            <div className="col-sm-10 d-flex align-items-center">
                                <div className="form-check form-check-inline">
                                    <input
                                        id="new-project-wizard-bb3-project-local"
                                        className="form-check-input"
                                        type="radio"
                                        name="new-project-wizard-bb3-project"
                                        value={1}
                                        checked={
                                            this.bb3ProjectOption == "local"
                                        }
                                        onChange={action(
                                            event =>
                                                (this.bb3ProjectOption = event
                                                    .target.checked
                                                    ? "local"
                                                    : "download")
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-bb3-project-local"
                                    >
                                        I already have a local copy
                                    </label>
                                </div>
                            </div>
                        </div>

                        {this.bb3ProjectOption == "download" &&
                            this.bb3ProjectFileDownloadError && (
                                <div className="mb-3 row">
                                    <div className="col-sm-2"></div>
                                    <div className="col-sm-10">
                                        <div className="text-danger">
                                            {this.bb3ProjectFileDownloadError}
                                        </div>
                                    </div>
                                </div>
                            )}

                        {this.bb3ProjectOption == "local" && (
                            <div className="mb-3 row">
                                <label className="col-sm-2 col-form-label">
                                    BB3 project file
                                </label>
                                <div className="col-sm-10">
                                    <FileBrowserInput
                                        value={this.bb3ProjectFile}
                                        onChange={action(
                                            (value: string | undefined) =>
                                                (this.bb3ProjectFile = value)
                                        )}
                                    />
                                    {this.bb3ProjectFileError && (
                                        <div className="text-danger">
                                            {this.bb3ProjectFileError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {this.step == 2 && (
                    <>
                        <div className="mb-3 row">
                            <h6>Which BB3 firmware version is your target?</h6>
                        </div>

                        <div className="mb-1 row">
                            <label className="col-sm-2 col-form-label"></label>
                            <div className="col-sm-10 d-flex align-items-center">
                                <div className="form-check form-check-inline">
                                    <input
                                        id="new-project-wizard-bb3-target-version-v3"
                                        className="form-check-input"
                                        type="radio"
                                        name="new-project-wizard-bb3-target"
                                        value={"v3"}
                                        checked={this.projectVersion == "v3"}
                                        onChange={action(
                                            event =>
                                                (this.projectVersion = event
                                                    .target.checked
                                                    ? "v3"
                                                    : "v2")
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-bb3-target-version-v3"
                                    >
                                        1.8 or newer
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="mb-3 row">
                            <label className="col-sm-2 col-form-label"></label>
                            <div className="col-sm-10 d-flex align-items-center">
                                <div className="form-check form-check-inline">
                                    <input
                                        id="new-project-wizard-bb3-target-version-v2"
                                        className="form-check-input"
                                        type="radio"
                                        name="new-project-wizard-bb3-target"
                                        value={"v2"}
                                        checked={this.projectVersion == "v2"}
                                        onChange={action(
                                            event =>
                                                (this.projectVersion = event
                                                    .target.checked
                                                    ? "v2"
                                                    : "v3")
                                        )}
                                    />
                                    <label
                                        className="form-check-label"
                                        htmlFor="new-project-wizard-bb3-target-version-v2"
                                    >
                                        1.7.X or older
                                    </label>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </BootstrapDialog>
        );
    }
}

export function showNewProjectWizard() {
    showDialog(<NewProjectWizard />);
}