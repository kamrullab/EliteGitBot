import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Login } from "./Login";
vi.mock("../api", () => ({ api: vi.fn().mockRejectedValue(new Error("Invalid credentials")) }));
describe("Login", () => { it("renders validation fields and reports authentication errors", async () => { render(<MemoryRouter><Login/></MemoryRouter>); fireEvent.change(screen.getByLabelText("Username"),{target:{value:"admin"}}); fireEvent.change(screen.getByLabelText("Password"),{target:{value:"incorrect"}}); fireEvent.click(screen.getByRole("button",{name:"Sign in"})); expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials"); }); });
