package com.zufar.bookshelf.controller;

import com.zufar.bookshelf.entity.User;
import com.zufar.bookshelf.service.CountryService;
import com.zufar.bookshelf.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.PostMapping;

@Controller
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CountryService countryService;

    @PostMapping("/registration")
    public String getRegistrationPage(ModelMap modelMap) {
        modelMap.addAttribute("user", new User());
        modelMap.addAttribute("countries", countryService.getAll());
        return "registrationView";
    }

    @PostMapping("/addUser")
    public String addUser(User user) {
        this.userService.save(user);
        return "home";
    }
}