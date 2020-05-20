package com.zufar.bookshelf.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping({"/", "/home"})
    public String getHomePage() {
        return "index";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }
}